import {
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Message, Role, Prisma } from '@prisma/client';
import {
  MessageContentBlock,
  isComputerToolUseContentBlock,
  isToolResultContentBlock,
  isUserActionContentBlock,
} from '@bytebot/shared';
import { TasksGateway } from '../tasks/tasks.gateway';
import {
  estimateMessageTokenCount,
  normalizeMessageTokens,
  TokenizedMessage,
} from './messages.tokens';

// Extended message type for processing
export interface ProcessedMessage extends Message {
  take_over?: boolean;
}

export interface GroupedMessages {
  role: Role;
  messages: ProcessedMessage[];
  take_over?: boolean;
}

@Injectable()
export class MessagesService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TasksGateway))
    private readonly tasksGateway: TasksGateway,
  ) {}

  async create(data: {
    content: MessageContentBlock[];
    role: Role;
    taskId: string;
  }): Promise<Message> {
    const message = await this.prisma.message.create({
      data: {
        content: data.content as Prisma.InputJsonValue,
        role: data.role,
        taskId: data.taskId,
        estimatedTokens: estimateMessageTokenCount(data.content),
      } as any,
    });

    this.tasksGateway.emitNewMessage(data.taskId, message);

    return message;
  }

  async findEvery(taskId: string): Promise<TokenizedMessage[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        taskId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return messages.map((message) => normalizeMessageTokens(message));
  }

  async findAll(
    taskId: string,
    options?: {
      limit?: number;
      page?: number;
    },
  ): Promise<TokenizedMessage[]> {
    const { limit = 10, page = 1 } = options || {};

    // Calculate offset based on page and limit
    const offset = (page - 1) * limit;

    const messages = await this.prisma.message.findMany({
      where: {
        taskId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: limit,
      skip: offset,
    });

    return messages.map((message) => normalizeMessageTokens(message));
  }

  async findUnsummarized(taskId: string): Promise<TokenizedMessage[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        taskId,
        // find messages that don't have a summaryId
        summaryId: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((message) => normalizeMessageTokens(message));
  }

  async findRecentMessages(
    taskId: string,
    limitTokens: number,
  ): Promise<{
    messages: TokenizedMessage[];
    totalTokens: number;
    totalCount: number;
    windowTokens: number;
    oldestMessageId: string | null;
    newestMessageId: string | null;
  }> {
    const unsummarized = await this.findUnsummarized(taskId);

    if (unsummarized.length === 0) {
      return {
        messages: [],
        totalTokens: 0,
        windowTokens: 0,
        totalCount: 0,
        oldestMessageId: null,
        newestMessageId: null,
      };
    }

    const normalized = unsummarized.map((message) =>
      normalizeMessageTokens(message),
    );

    const totalTokens = normalized.reduce(
      (sum, message) => sum + (message.estimatedTokens || 0),
      0,
    );

    const effectiveLimit = Math.max(limitTokens, 0);

    let accumulated = 0;
    const window: TokenizedMessage[] = [];

    for (let index = normalized.length - 1; index >= 0; index -= 1) {
      const current = normalized[index];
      const tokens = current.estimatedTokens || 0;

      if (accumulated + tokens > effectiveLimit && window.length > 0) {
        break;
      }

      accumulated += tokens;
      window.unshift(current);

      if (accumulated >= effectiveLimit) {
        break;
      }
    }

    const oldest = window[0]?.id ?? null;
    const newest = window[window.length - 1]?.id ?? null;

    return {
      messages: window,
      totalTokens,
      totalCount: normalized.length,
      windowTokens: accumulated,
      oldestMessageId: oldest,
      newestMessageId: newest,
    };
  }

  async attachSummary(
    taskId: string,
    summaryId: string,
    messageIds: string[],
  ): Promise<void> {
    if (messageIds.length === 0) {
      return;
    }

    await this.prisma.message.updateMany({
      where: { taskId, id: { in: messageIds } },
      data: { summaryId },
    });
  }

  /**
   * Groups back-to-back messages from the same role and take_over status
   */
  private groupBackToBackMessages(
    messages: ProcessedMessage[],
  ): GroupedMessages[] {
    const groupedConversation: GroupedMessages[] = [];
    let currentGroup: GroupedMessages | null = null;

    for (const message of messages) {
      const role = message.role;
      const isTakeOver = message.take_over || false;

      // If this is the first message, role is different, or take_over status is different from the previous group
      if (
        !currentGroup ||
        currentGroup.role !== role ||
        currentGroup.take_over !== isTakeOver
      ) {
        // Save the previous group if it exists
        if (currentGroup) {
          groupedConversation.push(currentGroup);
        }

        // Start a new group
        currentGroup = {
          role: role,
          messages: [message],
          take_over: isTakeOver,
        };
      } else {
        // Same role and take_over status as previous, merge the content
        currentGroup.messages.push(message);
      }
    }

    // Add the last group
    if (currentGroup) {
      groupedConversation.push(currentGroup);
    }

    return groupedConversation;
  }

  /**
   * Filters and processes messages, adding take_over flags where appropriate
   * Only text messages from the user should appear as user messages
   * Computer tool use messages should be shown as assistant messages with take_over flag
   */
  private filterMessages(messages: Message[]): ProcessedMessage[] {
    const filteredMessages: ProcessedMessage[] = [];

    for (const message of messages) {
      const processedMessage: ProcessedMessage = { ...message };
      const contentBlocks = message.content as MessageContentBlock[];

      // If the role is a user message and all the content blocks are tool result blocks or they are take over actions
      if (message.role === Role.USER) {
        if (contentBlocks.every((block) => isToolResultContentBlock(block))) {
          // Pure tool results should be shown as assistant messages
          processedMessage.role = Role.ASSISTANT;
        } else if (
          contentBlocks.every((block) => isUserActionContentBlock(block))
        ) {
          // Extract computer tool use (take over actions) from the user action content blocks and show them as assistant messages with take_over flag
          processedMessage.content = contentBlocks
            .flatMap((block) => {
              return block.content;
            })
            .filter((block) => isComputerToolUseContentBlock(block));
          processedMessage.role = Role.ASSISTANT;
          processedMessage.take_over = true;
        }
        // If there are text blocks mixed with tool blocks, keep as user message
        // Only pure text messages from user should remain as user messages
      }

      filteredMessages.push(processedMessage);
    }

    return filteredMessages;
  }

  /**
   * Returns raw messages without any processing
   */
  async findRawMessages(
    taskId: string,
    options?: {
      limit?: number;
      page?: number;
    },
  ): Promise<Message[]> {
    return this.findAll(taskId, options);
  }

  /**
   * Returns processed and grouped messages for the chat UI
   */
  async findProcessedMessages(
    taskId: string,
    options?: {
      limit?: number;
      page?: number;
    },
  ): Promise<GroupedMessages[]> {
    const messages = await this.findAll(taskId, options);
    const filteredMessages = this.filterMessages(messages);
    return this.groupBackToBackMessages(filteredMessages);
  }
}
