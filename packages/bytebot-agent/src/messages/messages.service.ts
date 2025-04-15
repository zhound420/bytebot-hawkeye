import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Message, MessageRole, Prisma } from '@prisma/client';
import { MessageContentBlock } from '../../../shared/types/messageContent.types';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new message
   * @param data Message data to create
   * @returns The created message
   */
  async create(data: {
    content: MessageContentBlock[];
    role: MessageRole;
    taskId: string;
  }): Promise<Message> {
    // Validate that the task exists
    const taskExists = await this.prisma.task.findUnique({
      where: { id: data.taskId },
    });

    if (!taskExists) {
      throw new NotFoundException(`Task with ID ${data.taskId} not found`);
    }

    return this.prisma.message.create({
      data: {
        content: data.content as Prisma.InputJsonValue,
        role: data.role,
        taskId: data.taskId,
      },
    });
  }
}
