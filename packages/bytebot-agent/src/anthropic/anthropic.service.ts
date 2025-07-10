import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic, { APIUserAbortError } from '@anthropic-ai/sdk';
import {
  MessageContentBlock,
  MessageContentType,
  TextContentBlock,
  ToolUseContentBlock,
  ThinkingContentBlock,
  RedactedThinkingContentBlock,
} from '@bytebot/shared';
import { DEFAULT_MODEL } from './anthropic.constants';
import { Message, Role } from '@prisma/client';
import { anthropicTools } from './anthropic.tools';
import {
  AGENT_SYSTEM_PROMPT,
  BytebotAgentInterrupt,
} from '../agent/agent.constants';

@Injectable()
export class AnthropicService {
  private readonly anthropic: Anthropic;
  private readonly logger = new Logger(AnthropicService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('ANTHROPIC_API_KEY');

    if (!apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY is not set. AnthropicService will not work properly.',
      );
    }

    this.anthropic = new Anthropic({
      apiKey: apiKey || 'dummy-key-for-initialization',
    });
  }

  /**
   * Sends a message to Anthropic Claude and returns the response
   *
   * @param messages Array of message content blocks representing the conversation
   * @param options Additional options for the API call
   * @returns The AI response as an array of message content blocks
   */
  async sendMessage(
    messages: Message[],
    model: string = DEFAULT_MODEL.name,
    signal?: AbortSignal,
  ): Promise<MessageContentBlock[]> {
    try {
      const maxTokens = 8192;

      // Convert our message content blocks to Anthropic's expected format
      const anthropicMessages = this.formatMessagesForAnthropic(messages);

      // add cache_control to last tool
      anthropicTools[anthropicTools.length - 1].cache_control = {
        type: 'ephemeral',
      };

      // Make the API call
      const response = await this.anthropic.messages.create(
        {
          model,
          max_tokens: maxTokens * 2,
          thinking: {
            type: 'enabled',
            budget_tokens: maxTokens,
          },
          system: [
            {
              type: 'text',
              text: AGENT_SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: anthropicMessages,
          tools: anthropicTools,
        },
        { signal },
      );

      // Convert Anthropic's response to our message content blocks format
      return this.formatAnthropicResponse(response.content);
    } catch (error) {
      this.logger.log(error);

      if (error instanceof APIUserAbortError) {
        this.logger.log('Anthropic API call aborted');
        throw new BytebotAgentInterrupt();
      }
      this.logger.error(
        `Error sending message to Anthropic: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Convert our MessageContentBlock format to Anthropic's message format
   */
  private formatMessagesForAnthropic(
    messages: Message[],
  ): Anthropic.MessageParam[] {
    const anthropicMessages: Anthropic.MessageParam[] = [];

    // Process each message content block
    for (const [index, message] of messages.entries()) {
      const messageContentBlocks = message.content as MessageContentBlock[];

      // Don't include user messages that have tool use
      if (
        message.role === Role.USER &&
        messageContentBlocks.some(
          (block) => block.type === MessageContentType.ToolUse,
        )
      ) {
        continue;
      }

      const content: Anthropic.ContentBlockParam[] = messageContentBlocks.map(
        (block) => block as Anthropic.ContentBlockParam,
      );

      if (index === messages.length - 1) {
        content[content.length - 1]['cache_control'] = {
          type: 'ephemeral',
        };
      }
      anthropicMessages.push({
        role: message.role === Role.USER ? 'user' : 'assistant',
        content: content,
      });
    }

    return anthropicMessages;
  }

  /**
   * Convert Anthropic's response content to our MessageContentBlock format
   */
  private formatAnthropicResponse(
    content: Anthropic.ContentBlock[],
  ): MessageContentBlock[] {
    return content.map((block) => {
      switch (block.type) {
        case 'text':
          return {
            type: MessageContentType.Text,
            text: block.text,
          } as TextContentBlock;

        case 'tool_use':
          return {
            type: MessageContentType.ToolUse,
            id: block.id,
            name: block.name,
            input: block.input,
          } as ToolUseContentBlock;

        case 'thinking':
          return {
            type: MessageContentType.Thinking,
            thinking: block.thinking,
            signature: block.signature,
          } as ThinkingContentBlock;

        case 'redacted_thinking':
          return {
            type: MessageContentType.RedactedThinking,
            data: block.data,
          } as RedactedThinkingContentBlock;
      }
    });
  }
}
