import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  MessageContentBlock,
  MessageContentType,
  TextContentBlock,
  ToolUseContentBlock,
} from '../../../shared/types/messageContent.types';
import { DEFAULT_DISPLAY_SIZE } from '../../../shared/constants';
import { AGENT_SYSTEM_PROMPT, DEFAULT_MODEL } from '../common/constants';
import { Message, MessageRole } from '@prisma/client';
import {
  createClickMouseToolUseBlock,
  createCursorPositionToolUseBlock,
  createDragMouseToolUseBlock,
  createMoveMouseToolUseBlock,
  createPressMouseToolUseBlock,
  createScreenshotToolUseBlock,
  createScrollToolUseBlock,
  createTypeKeysToolUseBlock,
  createTypeTextToolUseBlock,
  createWaitToolUseBlock,
  isClickMouseToolUseBlock,
  isComputerToolUseContentBlock,
  isCursorPositionToolUseBlock,
  isDragMouseToolUseBlock,
  isMoveMouseToolUseBlock,
  isPressMouseToolUseBlock,
  isScreenshotToolUseBlock,
  isScrollToolUseBlock,
  isTypeKeysToolUseBlock,
  isTypeTextToolUseBlock,
  isWaitToolUseBlock,
} from '../../../shared/utils/messageContent.utils';

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
  async sendMessage(messages: Message[]): Promise<MessageContentBlock[]> {
    try {
      const model = DEFAULT_MODEL;
      const maxTokens = 8192;
      const system = AGENT_SYSTEM_PROMPT;

      // Convert our message content blocks to Anthropic's expected format
      const anthropicMessages = this.formatMessagesForAnthropic(messages);

      // Make the API call
      const response = await this.anthropic.beta.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: anthropicMessages,
        tools: [
          {
            type: 'computer_20250124',
            name: 'computer',
            display_width_px: DEFAULT_DISPLAY_SIZE.width,
            display_height_px: DEFAULT_DISPLAY_SIZE.height,
            display_number: 1,
          },
        ],
        betas: ['computer-use-2025-01-24'],
      });

      // Convert Anthropic's response to our message content blocks format
      return this.formatAnthropicResponse(response.content);
    } catch (error) {
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
    for (const message of messages) {
      const messageContentBlocks = message.content as MessageContentBlock[];

      const content: Anthropic.ContentBlockParam[] = [];

      for (const block of messageContentBlocks) {
        // if (isComputerToolUseContentBlock(block)) {
        //   this.logger.debug(
        //     `Mapping back computer tool use block: ${JSON.stringify(block)}`,
        //   );
        // }

        if (isTypeKeysToolUseBlock(block)) {
          content.push({
            id: block.id,
            type: 'tool_use',
            name: 'computer',
            input: {
              action: 'key',
              text: block.input.keys.join('+'),
            },
          });
        } else if (isTypeTextToolUseBlock(block)) {
          content.push({
            id: block.id,
            type: 'tool_use',
            name: 'computer',
            input: {
              action: 'type',
              text: block.input.text,
            },
          });
        } else if (isCursorPositionToolUseBlock(block)) {
          content.push({
            id: block.id,
            type: 'tool_use',
            name: 'computer',
            input: {
              action: 'cursor_position',
            },
          });
        } else if (isMoveMouseToolUseBlock(block)) {
          content.push({
            id: block.id,
            type: 'tool_use',
            name: 'computer',
            input: {
              action: 'mouse_move',
              coordinate: [
                block.input.coordinates.x,
                block.input.coordinates.y,
              ],
            },
          });
        } else if (isPressMouseToolUseBlock(block)) {
          if (block.input.button === 'left' && block.input.press === 'down') {
            content.push({
              id: block.id,
              type: 'tool_use',
              name: 'computer',
              input: {
                action: 'left_mouse_down',
              },
            });
          }

          if (block.input.button === 'left' && block.input.press === 'up') {
            content.push({
              id: block.id,
              type: 'tool_use',
              name: 'computer',
              input: {
                action: 'left_mouse_up',
              },
            });
          }
        } else if (isClickMouseToolUseBlock(block)) {
          if (block.input.numClicks === 1) {
            if (block.input.button === 'left') {
              content.push({
                id: block.id,
                type: 'tool_use',
                name: 'computer',
                input: {
                  action: 'left_click',
                  ...(block.input.coordinates
                    ? {
                        coordinate: [
                          block.input.coordinates.x,
                          block.input.coordinates.y,
                        ],
                      }
                    : {}),
                },
              });
            }

            if (block.input.button === 'right') {
              content.push({
                id: block.id,
                type: 'tool_use',
                name: 'computer',
                input: {
                  action: 'right_click',
                  ...(block.input.coordinates
                    ? {
                        coordinate: [
                          block.input.coordinates.x,
                          block.input.coordinates.y,
                        ],
                      }
                    : {}),
                },
              });
            }

            if (block.input.button === 'middle') {
              content.push({
                id: block.id,
                type: 'tool_use',
                name: 'computer',
                input: {
                  action: 'middle_click',
                  ...(block.input.coordinates
                    ? {
                        coordinate: [
                          block.input.coordinates.x,
                          block.input.coordinates.y,
                        ],
                      }
                    : {}),
                },
              });
            }
          }

          if (block.input.numClicks === 2) {
            if (block.input.button === 'left') {
              content.push({
                id: block.id,
                type: 'tool_use',
                name: 'computer',
                input: {
                  action: 'double_click',
                  ...(block.input.coordinates
                    ? {
                        coordinate: [
                          block.input.coordinates.x,
                          block.input.coordinates.y,
                        ],
                      }
                    : {}),
                },
              });
            }
          }

          if (block.input.numClicks === 3) {
            if (block.input.button === 'left') {
              content.push({
                id: block.id,
                type: 'tool_use',
                name: 'computer',
                input: {
                  action: 'triple_click',
                  ...(block.input.coordinates
                    ? {
                        coordinate: [
                          block.input.coordinates.x,
                          block.input.coordinates.y,
                        ],
                      }
                    : {}),
                },
              });
            }
          }
        } else if (isDragMouseToolUseBlock(block)) {
          content.push({
            id: block.id,
            type: 'tool_use',
            name: 'computer',
            input: {
              action: 'left_click_drag',
              start_coordinate: [block.input.path[0].x, block.input.path[0].y],
              coordinate: [
                block.input.path[block.input.path.length - 1].x,
                block.input.path[block.input.path.length - 1].y,
              ],
            },
          });
        } else if (isScrollToolUseBlock(block)) {
          content.push({
            id: block.id,
            type: 'tool_use',
            name: 'computer',
            input: {
              action: 'scroll',
              scroll_amount: block.input.numScrolls,
              scroll_direction: block.input.direction,
              ...(block.input.coordinates
                ? {
                    coordinate: [
                      block.input.coordinates.x,
                      block.input.coordinates.y,
                    ],
                  }
                : {}),
            },
          });
        } else if (isWaitToolUseBlock(block)) {
          content.push({
            id: block.id,
            type: 'tool_use',
            name: 'computer',
            input: {
              action: 'wait',
              duration: block.input.duration,
            },
          });
        } else if (isScreenshotToolUseBlock(block)) {
          content.push({
            id: block.id,
            type: 'tool_use',
            name: 'computer',
            input: {
              action: 'screenshot',
            },
          });
        } else {
          content.push(block as Anthropic.ContentBlockParam);
        }
      }

      anthropicMessages.push({
        role: message.role === MessageRole.USER ? 'user' : 'assistant',
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
          return this.mapToolUseBlock(block);

        default:
          this.logger.warn(
            `Unknown content block type from Anthropic: ${block.type}`,
          );
          return {
            type: MessageContentType.Text,
            text: JSON.stringify(block),
          } as TextContentBlock;
      }
    });
  }

  private mapToolUseBlock(block: Anthropic.ToolUseBlock): ToolUseContentBlock {
    // this.logger.debug(`Mapping tool use block: ${JSON.stringify(block)}`);

    if (block.name.startsWith('computer')) {
      const input = block.input as Record<string, unknown>;

      switch (input.action) {
        case 'key':
        case 'hold_key': {
          const keys = input.text as string;
          return createTypeKeysToolUseBlock({
            id: block.id,
            keys: keys.split('+'),
          });
        }
        case 'type': {
          const text = input.text as string;
          return createTypeTextToolUseBlock({ id: block.id, text });
        }
        case 'cursor_position': {
          return createCursorPositionToolUseBlock({ id: block.id });
        }
        case 'mouse_move': {
          const coordinates = input.coordinate as [number, number];
          return createMoveMouseToolUseBlock({
            id: block.id,
            coordinates: {
              x: coordinates[0],
              y: coordinates[1],
            },
          });
        }
        case 'left_mouse_down': {
          return createPressMouseToolUseBlock({
            id: block.id,
            button: 'left',
            press: 'down',
          });
        }
        case 'left_mouse_up': {
          return createPressMouseToolUseBlock({
            id: block.id,
            button: 'left',
            press: 'up',
          });
        }
        case 'left_click': {
          const coordinates = input.coordinate as [number, number];
          return createClickMouseToolUseBlock({
            id: block.id,
            ...(coordinates
              ? { coordinates: { x: coordinates[0], y: coordinates[1] } }
              : {}),
            button: 'left',
            numClicks: 1,
          });
        }
        case 'left_click_drag': {
          const start_coordinates = input.start_coordinate as [number, number];
          const coordinates = input.coordinate as [number, number];
          return createDragMouseToolUseBlock({
            id: block.id,
            path: [
              {
                x: start_coordinates[0],
                y: start_coordinates[1],
              },
              {
                x: coordinates[0],
                y: coordinates[1],
              },
            ],
            button: 'left',
          });
        }
        case 'right_click': {
          const coordinates = input.coordinate as [number, number];
          return createClickMouseToolUseBlock({
            id: block.id,
            ...(coordinates
              ? { coordinates: { x: coordinates[0], y: coordinates[1] } }
              : {}),
            button: 'right',
            numClicks: 1,
          });
        }
        case 'middle_click': {
          const coordinates = input.coordinate as [number, number];
          return createClickMouseToolUseBlock({
            id: block.id,
            ...(coordinates
              ? { coordinates: { x: coordinates[0], y: coordinates[1] } }
              : {}),
            button: 'middle',
            numClicks: 1,
          });
        }
        case 'double_click': {
          const coordinates = input.coordinate as [number, number];
          return createClickMouseToolUseBlock({
            id: block.id,
            ...(coordinates
              ? { coordinates: { x: coordinates[0], y: coordinates[1] } }
              : {}),
            button: 'left',
            numClicks: 2,
          });
        }
        case 'triple_click': {
          const coordinates = input.coordinate as [number, number];
          return createClickMouseToolUseBlock({
            id: block.id,
            ...(coordinates
              ? { coordinates: { x: coordinates[0], y: coordinates[1] } }
              : {}),
            button: 'left',
            numClicks: 3,
          });
        }
        case 'scroll': {
          const coordinates = input.coordinate as [number, number];
          const direction = input.scroll_direction as
            | 'up'
            | 'down'
            | 'left'
            | 'right';
          const scroll_amount = input.scroll_amount as number;
          return createScrollToolUseBlock({
            id: block.id,

            ...(coordinates
              ? { coordinates: { x: coordinates[0], y: coordinates[1] } }
              : {}),
            direction,
            numScrolls: scroll_amount,
          });
        }
        case 'wait': {
          return createWaitToolUseBlock({
            id: block.id,
            duration: input.duration as number,
          });
        }
        case 'screenshot': {
          return createScreenshotToolUseBlock({ id: block.id });
        }
      }
    }

    return {
      type: MessageContentType.ToolUse,
      name: block.name,
      id: block.id,
      input: block.input as Record<string, unknown>,
    } as ToolUseContentBlock;
  }
}
