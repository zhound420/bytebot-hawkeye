import { TasksService } from '../tasks/tasks.service';
import { MessagesService } from '../messages/messages.service';
import { Injectable, Logger } from '@nestjs/common';
import { MessageType, TaskStatus } from '@prisma/client';
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

@Injectable()
export class AgentOrchestratorService {
  constructor(
    private readonly tasksService: TasksService,
    private readonly messagesService: MessagesService,
    private readonly anthropicService: AnthropicService,
  ) {}

  private readonly logger = new Logger(AgentOrchestratorService.name);

  async runAgentLoop(taskId: string) {
    const task = await this.tasksService.findById(taskId);

    if (task.status != TaskStatus.IN_PROGRESS) {
      return;
    }

    const messages = task.messages;

    const messageContentBlocks: MessageContentBlock[] =
      await this.anthropicService.sendMessage(messages);

    await this.messagesService.create({
      content: messageContentBlocks,
      type: MessageType.ASSISTANT,
      taskId: taskId,
    });

    let toolUseCount = 0;

    for (const block of messageContentBlocks) {
      if (isComputerToolUseContentBlock(block)) {
        toolUseCount++;
        const toolResult = await this.handleComputerToolUse(block);
        await this.messagesService.create({
          content: [toolResult],
          type: MessageType.USER,
          taskId: taskId,
        });
      }
    }

    if (toolUseCount === 0) {
      await this.tasksService.update(taskId, { status: TaskStatus.COMPLETED });
    } else {
      // signal that we should loop again
    }
  }

  private async handleComputerToolUse(
    block: ComputerToolUseContentBlock,
  ): Promise<ToolResultContentBlock> {
    if (isScreenshotToolUseBlock(block)) {
      try {
        const image = await screenshot();

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
        return {
          type: MessageContentType.ToolResult,
          tool_use_id: block.id,
          content: [
            {
              type: MessageContentType.Text,
              text: 'ERROR: Failed to take screenshot',
            },
          ],
        };
      }
    }

    if (isCursorPositionToolUseBlock(block)) {
      try {
        const position = await cursor_position();

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
        return {
          type: MessageContentType.ToolResult,
          tool_use_id: block.id,
          content: [
            {
              type: MessageContentType.Text,
              text: 'ERROR: Failed to get cursor position',
            },
          ],
        };
      }
    }

    try {
      if (isKeyToolUseBlock(block)) {
        await key(block.input.text);
      }
      if (isHoldKeyToolUseBlock(block)) {
        await hold_key(block.input.text, block.input.duration);
      }
      if (isTypeToolUseBlock(block)) {
        await type(block.input.text);
      }

      if (isMouseMoveToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        await mouse_move({ x: coordinate[0], y: coordinate[1] });
      }

      if (isLeftClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        await left_click({ x: coordinate[0], y: coordinate[1] });
      }

      if (isLeftClickDragToolUseBlock(block)) {
        const startCoordinate = block.input.start_coordinate;
        const endCoordinate = block.input.coordinate;
        const holdKeys = block.input.text ? block.input.text.split('+') : [];
        await left_click_drag(
          { x: startCoordinate[0], y: startCoordinate[1] },
          { x: endCoordinate[0], y: endCoordinate[1] },
          holdKeys,
        );
      }

      if (isLeftMouseDownToolUseBlock(block)) {
        await left_mouse_down();
      }

      if (isLeftMouseUpToolUseBlock(block)) {
        await left_mouse_up();
      }

      if (isRightClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        await right_click({ x: coordinate[0], y: coordinate[1] });
      }

      if (isMiddleClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        await middle_click({ x: coordinate[0], y: coordinate[1] });
      }

      if (isDoubleClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        await double_click({ x: coordinate[0], y: coordinate[1] });
      }

      if (isTripleClickToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        await triple_click({ x: coordinate[0], y: coordinate[1] });
      }

      if (isScrollToolUseBlock(block)) {
        const coordinate = block.input.coordinate;
        await scroll(
          { x: coordinate[0], y: coordinate[1] },
          block.input.scroll_direction,
          block.input.scroll_amount,
        );
      }

      if (isWaitToolUseBlock(block)) {
        await wait(block.input.duration);
      }

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
      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: `Error executing ${block.input.action} tool: ${error.message}`,
          },
        ],
      };
    }
  }
}
