import { TasksService } from '../tasks/tasks.service';
import { MessagesService } from '../messages/messages.service';
import { Logger } from '@nestjs/common';
import { MessageRole, TaskStatus } from '@prisma/client';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { AnthropicService } from '../anthropic/anthropic.service';
import {
  isKeyToolUseBlock,
  isHoldKeyToolUseBlock,
  isTypeToolUseBlock,
  isMouseMoveToolUseBlock,
  isLeftClickToolUseBlock,
  isRightClickToolUseBlock,
  isMiddleClickToolUseBlock,
  isDoubleClickToolUseBlock,
  isTripleClickToolUseBlock,
  isScrollToolUseBlock,
  isWaitToolUseBlock,
  isScreenshotToolUseBlock,
  isLeftClickDragToolUseBlock,
  isLeftMouseDownToolUseBlock,
  isLeftMouseUpToolUseBlock,
  isCursorPositionToolUseBlock,
  isComputerToolUseContentBlock,
} from '../../../shared/utils/messageContent.utils';
import {
  ComputerToolUseContentBlock,
  MessageContentBlock,
  MessageContentType,
  ToolResultContentBlock,
} from '../../../shared/types/messageContent.types';
import {
  cursor_position,
  double_click,
  hold_key,
  key,
  left_click,
  left_click_drag,
  left_mouse_down,
  left_mouse_up,
  middle_click,
  mouse_move,
  right_click,
  screenshot,
  scroll,
  triple_click,
  type,
  wait,
} from './agent.utils';
import { AGENT_QUEUE_NAME } from '../common/constants';
import { Job } from 'bullmq';

@Processor(AGENT_QUEUE_NAME)
export class AgentProcessor extends WorkerHost {
  private readonly logger = new Logger(AgentProcessor.name);

  constructor(
    private readonly tasksService: TasksService,
    private readonly messagesService: MessagesService,
    private readonly anthropicService: AnthropicService,
  ) {
    super();
    this.logger.log('AgentProcessor initialized');
  }

  async process(job: Job) {
    const taskId = job.data.taskId;
    this.logger.log(`Processing job for task ID: ${taskId}`);

    try {
      let task = await this.tasksService.findById(taskId);
      this.logger.debug(
        `Task status: ${task.status}, found ${task.messages.length} messages`,
      );

      while (task.status == TaskStatus.IN_PROGRESS) {
        this.logger.log(
          `Processing task loop iteration for task ID: ${taskId}`,
        );
        const messages = task.messages;
        this.logger.debug(
          `Sending ${messages.length} messages to LLM for processing`,
        );

        try {
          const messageContentBlocks: MessageContentBlock[] =
            await this.anthropicService.sendMessage(messages);
          this.logger.debug(
            `Received ${messageContentBlocks.length} content blocks from LLM`,
          );

          await this.messagesService.create({
            content: messageContentBlocks,
            role: MessageRole.ASSISTANT,
            taskId: taskId,
          });
          this.logger.debug(
            `Saved assistant response to database for task ID: ${taskId}`,
          );

          let toolUseCount = 0;

          for (const block of messageContentBlocks) {
            if (isComputerToolUseContentBlock(block)) {
              toolUseCount++;
              this.logger.log(
                `Processing tool use block #${toolUseCount}: ${block.input.action}`,
              );

              const toolResult = await this.handleComputerToolUse(block);
              this.logger.debug(`Tool execution completed, saving result`);

              await this.messagesService.create({
                content: [toolResult],
                role: MessageRole.USER,
                taskId: taskId,
              });
              this.logger.debug(
                `Tool result saved to database for task ID: ${taskId}`,
              );
            }
          }

          this.logger.log(
            `Processed ${toolUseCount} tool use blocks for task ID: ${taskId}`,
          );

          if (toolUseCount === 0) {
            // We interpret this as a signal to complete the task
            this.logger.log(
              `No tool use blocks detected, marking task ID: ${taskId} as COMPLETED`,
            );
            await this.tasksService.update(taskId, {
              status: TaskStatus.COMPLETED,
            });
            this.logger.log(`Task ID: ${taskId} has been completed`);
            break;
          }

          this.logger.debug(`Refreshing task data for task ID: ${taskId}`);
          task = await this.tasksService.findById(taskId);
          this.logger.debug(
            `Task refreshed, status: ${task.status}, messages count: ${task.messages.length}`,
          );
        } catch (error) {
          this.logger.error(
            `Error during task processing loop for task ID: ${taskId} - ${error.message}`,
            error.stack,
          );
          // Update task to error state or retry logic could be added here
          break;
        }
      }

      this.logger.log(
        `Task processing completed for task ID: ${taskId} with status: ${task.status}`,
      );
    } catch (error) {
      this.logger.error(
        `Critical error processing job for task ID: ${taskId} - ${error.message}`,
        error.stack,
      );
      // Could implement fallback logic here
    }
  }

  private async handleComputerToolUse(
    block: ComputerToolUseContentBlock,
  ): Promise<ToolResultContentBlock> {
    this.logger.debug(
      `Handling computer tool use: ${block.input.action}, tool_use_id: ${block.id}`,
    );

    if (isScreenshotToolUseBlock(block)) {
      this.logger.debug('Processing screenshot request');
      try {
        this.logger.debug('Taking screenshot');
        const image = await screenshot();
        this.logger.debug('Screenshot captured successfully');

        return {
          type: MessageContentType.ToolResult,
          tool_use_id: block.id,
          content: [
            {
              type: MessageContentType.Image,
              source: {
                data: image,
                media_type: 'image/png',
                type: 'base64',
              },
            },
          ],
        };
      } catch (error) {
        this.logger.error(`Screenshot failed: ${error.message}`, error.stack);
        return {
          type: MessageContentType.ToolResult,
          tool_use_id: block.id,
          content: [
            {
              type: MessageContentType.Text,
              text: 'ERROR: Failed to take screenshot',
            },
          ],
          is_error: true,
        };
      }
    }

    if (isCursorPositionToolUseBlock(block)) {
      this.logger.debug('Processing cursor position request');
      try {
        this.logger.debug('Getting cursor position');
        const position = await cursor_position();
        this.logger.debug(
          `Cursor position obtained: ${position.x}, ${position.y}`,
        );

        return {
          type: MessageContentType.ToolResult,
          tool_use_id: block.id,
          content: [
            {
              type: MessageContentType.Text,
              text: `Cursor position: ${position.x}, ${position.y}`,
            },
          ],
        };
      } catch (error) {
        this.logger.error(
          `Getting cursor position failed: ${error.message}`,
          error.stack,
        );
        return {
          type: MessageContentType.ToolResult,
          tool_use_id: block.id,
          content: [
            {
              type: MessageContentType.Text,
              text: 'ERROR: Failed to get cursor position',
            },
          ],
          is_error: true,
        };
      }
    }

    try {
      if (isKeyToolUseBlock(block)) {
        this.logger.debug(`Pressing key: ${block.input.text}`);
        await key(block.input.text);
        this.logger.debug(`Key press completed: ${block.input.text}`);
      }
      if (isHoldKeyToolUseBlock(block)) {
        this.logger.debug(
          `Holding key: ${block.input.text} for ${block.input.duration}ms`,
        );
        await hold_key(block.input.text, block.input.duration);
        this.logger.debug(`Key hold completed: ${block.input.text}`);
      }
      if (isTypeToolUseBlock(block)) {
        this.logger.debug(
          `Typing text: ${block.input.text.substring(0, 20)}${block.input.text.length > 20 ? '...' : ''}`,
        );
        await type(block.input.text);
        this.logger.debug('Text typing completed');
      }

      if (isMouseMoveToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        this.logger.debug(
          `Moving mouse to coordinates: ${coordinate[0]}, ${coordinate[1]}`,
        );
        await mouse_move({ x: coordinate[0], y: coordinate[1] });
        this.logger.debug('Mouse move completed');
      }

      if (isLeftClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        this.logger.debug(
          `Left clicking at coordinates: ${coordinate[0]}, ${coordinate[1]}`,
        );
        await left_click({ x: coordinate[0], y: coordinate[1] });
        this.logger.debug('Left click completed');
      }

      if (isLeftClickDragToolUseBlock(block)) {
        const startCoordinate = block.input.start_coordinate;
        const endCoordinate = block.input.coordinate;
        const holdKeys = block.input.text ? block.input.text.split('+') : [];
        this.logger.debug(
          `Left click drag from (${startCoordinate[0]}, ${startCoordinate[1]}) to (${endCoordinate[0]}, ${endCoordinate[1]})${
            holdKeys.length > 0
              ? ` while holding keys: ${holdKeys.join('+')}`
              : ''
          }`,
        );
        await left_click_drag(
          { x: startCoordinate[0], y: startCoordinate[1] },
          { x: endCoordinate[0], y: endCoordinate[1] },
          holdKeys,
        );
        this.logger.debug('Left click drag completed');
      }

      if (isLeftMouseDownToolUseBlock(block)) {
        this.logger.debug('Pressing left mouse button down');
        await left_mouse_down();
        this.logger.debug('Left mouse down completed');
      }

      if (isLeftMouseUpToolUseBlock(block)) {
        this.logger.debug('Releasing left mouse button');
        await left_mouse_up();
        this.logger.debug('Left mouse up completed');
      }

      if (isRightClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        this.logger.debug(
          `Right clicking at coordinates: ${coordinate[0]}, ${coordinate[1]}`,
        );
        await right_click({ x: coordinate[0], y: coordinate[1] });
        this.logger.debug('Right click completed');
      }

      if (isMiddleClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        this.logger.debug(
          `Middle clicking at coordinates: ${coordinate[0]}, ${coordinate[1]}`,
        );
        await middle_click({ x: coordinate[0], y: coordinate[1] });
        this.logger.debug('Middle click completed');
      }

      if (isDoubleClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        this.logger.debug(
          `Double clicking at coordinates: ${coordinate[0]}, ${coordinate[1]}`,
        );
        await double_click({ x: coordinate[0], y: coordinate[1] });
        this.logger.debug('Double click completed');
      }

      if (isTripleClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        this.logger.debug(
          `Triple clicking at coordinates: ${coordinate[0]}, ${coordinate[1]}`,
        );
        await triple_click({ x: coordinate[0], y: coordinate[1] });
        this.logger.debug('Triple click completed');
      }

      if (isScrollToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        this.logger.debug(
          `Scrolling at coordinates: ${coordinate[0]}, ${coordinate[1]} in direction ${block.input.scroll_direction} with amount ${block.input.scroll_amount}`,
        );
        await scroll(
          { x: coordinate[0], y: coordinate[1] },
          block.input.scroll_direction,
          block.input.scroll_amount,
        );
        this.logger.debug('Scroll completed');
      }

      if (isWaitToolUseBlock(block)) {
        this.logger.debug(`Waiting for ${block.input.duration}ms`);
        await wait(block.input.duration);
        this.logger.debug('Wait completed');
      }

      this.logger.debug(
        `Tool execution successful for tool_use_id: ${block.id}`,
      );
      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: 'Tool executed successfully',
          },
        ],
      };
    } catch (error) {
      this.logger.error(
        `Error executing ${block.input.action} tool: ${error.message}`,
        error.stack,
      );
      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: `Error executing ${block.input.action} tool: ${error.message}`,
          },
        ],
        is_error: true,
      };
    }
  }
}
