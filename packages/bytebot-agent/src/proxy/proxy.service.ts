import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIUserAbortError } from 'openai';
import {
  ChatCompletionMessageParam,
  ChatCompletionContentPart,
} from 'openai/resources/chat/completions';
import {
  MessageContentBlock,
  MessageContentType,
  TextContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
  ImageContentBlock,
  isUserActionContentBlock,
  isComputerToolUseContentBlock,
  isImageContentBlock,
  ThinkingContentBlock,
} from '@bytebot/shared';
import { Message, Role } from '@prisma/client';
import { proxyTools } from './proxy.tools';
import {
  BytebotAgentService,
  BytebotAgentInterrupt,
  BytebotAgentResponse,
} from '../agent/agent.types';

@Injectable()
export class ProxyService implements BytebotAgentService {
  private readonly openai: OpenAI;
  private readonly logger = new Logger(ProxyService.name);

  constructor(private readonly configService: ConfigService) {
    const proxyUrl = this.configService.get<string>('BYTEBOT_LLM_PROXY_URL');

    if (!proxyUrl) {
      this.logger.warn(
        'BYTEBOT_LLM_PROXY_URL is not set. ProxyService will not work properly.',
      );
    }

    // Initialize OpenAI client with proxy configuration
    this.openai = new OpenAI({
      apiKey: 'dummy-key-for-proxy',
      baseURL: proxyUrl,
    });
  }

  /**
   * Main method to generate messages using the Chat Completions API
   */
  async generateMessage(
    systemPrompt: string,
    messages: Message[],
    model: string,
    useTools: boolean = true,
    signal?: AbortSignal,
  ): Promise<BytebotAgentResponse> {
    // Convert messages to Chat Completion format
    const chatMessages = this.formatMessagesForChatCompletion(
      systemPrompt,
      messages,
    );
    try {
      // Prepare the Chat Completion request
      const completionRequest: OpenAI.Chat.ChatCompletionCreateParams = {
        model,
        messages: chatMessages,
        max_tokens: 8192,
        ...(useTools && { tools: proxyTools }),
        reasoning_effort: 'high',
      };

      // Make the API call
      const completion = await this.openai.chat.completions.create(
        completionRequest,
        { signal },
      );

      // Process the response
      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No valid response from Chat Completion API');
      }

      // Convert response to MessageContentBlocks
      const contentBlocks = this.formatChatCompletionResponse(choice.message);

      return {
        contentBlocks,
        tokenUsage: {
          inputTokens: completion.usage?.prompt_tokens || 0,
          outputTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      if (error instanceof APIUserAbortError) {
        this.logger.log('Chat Completion API call aborted');
        throw new BytebotAgentInterrupt();
      }

      this.logger.error(
        `Error sending message to proxy: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Convert Bytebot messages to Chat Completion format
   */
  private formatMessagesForChatCompletion(
    systemPrompt: string,
    messages: Message[],
  ): ChatCompletionMessageParam[] {
    const chatMessages: ChatCompletionMessageParam[] = [];

    // Add system message
    chatMessages.push({
      role: 'system',
      content: systemPrompt,
    });

    // Process each message
    for (const message of messages) {
      const messageContentBlocks = message.content as MessageContentBlock[];

      // Handle user actions specially
      if (
        messageContentBlocks.every((block) => isUserActionContentBlock(block))
      ) {
        const userActionBlocks = messageContentBlocks.flatMap(
          (block) => block.content,
        );

        for (const block of userActionBlocks) {
          if (isComputerToolUseContentBlock(block)) {
            chatMessages.push({
              role: 'user',
              content: `User performed action: ${block.name}\n${JSON.stringify(
                block.input,
                null,
                2,
              )}`,
            });
          } else if (isImageContentBlock(block)) {
            chatMessages.push({
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${block.source.media_type};base64,${block.source.data}`,
                    detail: 'high',
                  },
                },
              ],
            });
          }
        }
      } else {
        // Group assistant messages into a single ChatCompletion message with combined content/tool_calls/reasoning
        if (message.role === Role.ASSISTANT) {
          const textParts: string[] = [];
          const toolCalls: any[] = [];
          let reasoningContent: string | null = null;

          for (const block of messageContentBlocks) {
            switch (block.type) {
              case MessageContentType.Text:
                textParts.push((block as TextContentBlock).text);
                break;
              case MessageContentType.ToolUse: {
                const toolBlock = block as ToolUseContentBlock;
                toolCalls.push({
                  id: toolBlock.id,
                  type: 'function',
                  function: {
                    name: toolBlock.name,
                    arguments: JSON.stringify(toolBlock.input),
                  },
                });
                break;
              }
              case MessageContentType.Thinking:
                reasoningContent = (block as ThinkingContentBlock).thinking;
                break;
              default:
                // ignore other types in assistant message
                break;
            }
          }

          const assistantMsg: ChatCompletionMessageParam = {
            role: 'assistant',
            content: textParts.length ? textParts.join('\n') : '',
          } as ChatCompletionMessageParam;
          if (toolCalls.length) (assistantMsg as any).tool_calls = toolCalls;
          if (reasoningContent) (assistantMsg as any).reasoning_content = reasoningContent;
          chatMessages.push(assistantMsg);
        } else {
          // Handle user messages normally, including tool results
          for (const block of messageContentBlocks) {
            switch (block.type) {
              case MessageContentType.Text:
                chatMessages.push({ role: 'user', content: (block as TextContentBlock).text });
                break;
              case MessageContentType.Image: {
                const imageBlock = block as ImageContentBlock;
                chatMessages.push({
                  role: 'user',
                  content: [
                    {
                      type: 'image_url',
                      image_url: {
                        url: `data:${imageBlock.source.media_type};base64,${imageBlock.source.data}`,
                        detail: 'high',
                      },
                    },
                  ],
                });
                break;
              }
              case MessageContentType.ToolResult: {
                const toolResultBlock = block as ToolResultContentBlock;
                // 1) Respond to tool_calls with role='tool' messages immediately
                let responded = false;
                const pendingImages: { media_type: string; data: string }[] = [];
                for (const content of toolResultBlock.content) {
                  if (content.type === MessageContentType.Text) {
                    chatMessages.push({
                      role: 'tool',
                      tool_call_id: toolResultBlock.tool_use_id,
                      content: content.text,
                    });
                    responded = true;
                  } else if (content.type === MessageContentType.Image) {
                    // Summarize via tool message; queue actual image for a follow-up user message
                    if (!responded) {
                      chatMessages.push({
                        role: 'tool',
                        tool_call_id: toolResultBlock.tool_use_id,
                        content: 'screenshot',
                      });
                      responded = true;
                    }
                    pendingImages.push({
                      media_type: content.source.media_type,
                      data: content.source.data,
                    });
                  }
                }
                // 2) After tool responses, provide the actual screenshot(s) as a user image message
                if (pendingImages.length > 0) {
                  chatMessages.push({
                    role: 'user',
                    content: [
                      { type: 'text', text: 'Screenshot' },
                      ...pendingImages.map((img) => ({
                        type: 'image_url',
                        image_url: {
                          url: `data:${img.media_type};base64,${img.data}`,
                          detail: 'high',
                        },
                      } as ChatCompletionContentPart)),
                    ],
                  });
                }
                break;
              }
              default:
                // ignore
                break;
            }
          }
        }
      }
    }

    return this.sanitizeChatMessages(chatMessages);
  }

  /**
   * Ensures Chat Completions sequence validity:
   * - Any role='tool' must immediately respond to a preceding assistant message with tool_calls
   * - If a stray tool message is found (no pending tool_calls), convert it to a user text message
   */
  private sanitizeChatMessages(
    messages: ChatCompletionMessageParam[],
  ): ChatCompletionMessageParam[] {
    const result: ChatCompletionMessageParam[] = [];
    let pendingToolCallIds: Set<string> = new Set();
    let lastAssistantWithToolCalls: ChatCompletionMessageParam | null = null;

    const flushPendingToolCalls = () => {
      if (
        pendingToolCallIds.size === 0 ||
        !lastAssistantWithToolCalls ||
        !(lastAssistantWithToolCalls as any).tool_calls
      ) {
        pendingToolCallIds = new Set();
        lastAssistantWithToolCalls = null;
        return;
      }

      const assistant = lastAssistantWithToolCalls as any;
      const originalToolCalls = Array.isArray(assistant.tool_calls)
        ? (assistant.tool_calls as any[])
        : [];
      const unresolvedCalls = originalToolCalls.filter(
        (tc: any) => tc && typeof tc.id === 'string' && pendingToolCallIds.has(tc.id),
      );

      if (unresolvedCalls.length > 0) {
        const resolvedCalls = originalToolCalls.filter(
          (tc: any) => tc && typeof tc.id === 'string' && !pendingToolCallIds.has(tc.id),
        );

        if (resolvedCalls.length > 0) {
          assistant.tool_calls = resolvedCalls;
        } else {
          delete assistant.tool_calls;
        }

        const fallbackText = unresolvedCalls
          .map((tc: any) => {
            const name = tc?.function?.name ?? 'unknown';
            return `[tool-call:${name}] unresolved`;
          })
          .join('\n');

        if (Array.isArray(assistant.content)) {
          assistant.content = [
            ...assistant.content,
            { type: 'text', text: fallbackText } as ChatCompletionContentPart,
          ];
        } else {
          const existingContent =
            typeof assistant.content === 'string' ? assistant.content : '';
          assistant.content = existingContent
            ? `${existingContent}\n${fallbackText}`
            : fallbackText;
        }
      }

      pendingToolCallIds = new Set();
      lastAssistantWithToolCalls = null;
    };

    for (const msg of messages) {
      const toolCalls: any[] = (msg as any).tool_calls || [];
      if (msg.role === 'assistant' && Array.isArray(toolCalls) && toolCalls.length > 0) {
        flushPendingToolCalls();
        // Start a new pending tool_calls window
        pendingToolCallIds = new Set(
          toolCalls
            .filter((tc) => tc && typeof tc.id === 'string')
            .map((tc) => tc.id as string),
        );
        lastAssistantWithToolCalls = msg;
        result.push(msg);
        continue;
      }

      if (msg.role === 'tool') {
        const callId = (msg as any).tool_call_id as string | undefined;
        if (callId && pendingToolCallIds.has(callId)) {
          // Valid response
          pendingToolCallIds.delete(callId);
          if (pendingToolCallIds.size === 0) {
            pendingToolCallIds = new Set();
            lastAssistantWithToolCalls = null;
          }
          result.push(msg);
        } else {
          // Fallback: convert to user text to avoid API 400, include hint
          const content = (msg as any).content ?? '[tool result]';
          result.push({ role: 'user', content: `[tool:${callId ?? 'unknown'}] ${content}` });
          flushPendingToolCalls();
        }
        continue;
      }

      // Any non-tool message breaks the immediate requirement; clear pending
      flushPendingToolCalls();
      result.push(msg);
    }

    flushPendingToolCalls();

    return result;
  }

  /**
   * Convert Chat Completion response to MessageContentBlocks
   */
  private formatChatCompletionResponse(
    message: OpenAI.Chat.ChatCompletionMessage,
  ): MessageContentBlock[] {
    const contentBlocks: MessageContentBlock[] = [];

    // Handle text content
    if (message.content) {
      contentBlocks.push({
        type: MessageContentType.Text,
        text: message.content,
      } as TextContentBlock);
    }

    if (message['reasoning_content']) {
      contentBlocks.push({
        type: MessageContentType.Thinking,
        thinking: message['reasoning_content'],
        signature: message['reasoning_content'],
      } as ThinkingContentBlock);
    }

    // Handle tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          let parsedInput = {};
          try {
            parsedInput = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            this.logger.warn(
              `Failed to parse tool call arguments: ${toolCall.function.arguments}`,
            );
            parsedInput = {};
          }

          contentBlocks.push({
            type: MessageContentType.ToolUse,
            id: toolCall.id,
            name: toolCall.function.name,
            input: parsedInput,
          } as ToolUseContentBlock);
        }
      }
    }

    // Handle refusal
    if (message.refusal) {
      contentBlocks.push({
        type: MessageContentType.Text,
        text: `Refusal: ${message.refusal}`,
      } as TextContentBlock);
    }

    return contentBlocks;
  }
}
