import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Message, Role, Prisma } from '@prisma/client';
import { MessageContentBlock } from '@bytebot/shared';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    content: MessageContentBlock[];
    role: Role;
    taskId: string;
  }): Promise<Message> {
    return this.prisma.message.create({
      data: {
        content: data.content as Prisma.InputJsonValue,
        role: data.role,
        taskId: data.taskId,
      },
    });
  }

  async findAll(taskId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: {
        taskId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}
