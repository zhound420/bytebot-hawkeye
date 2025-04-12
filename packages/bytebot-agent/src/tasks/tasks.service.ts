import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, MessageType } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(private prisma: PrismaService) {}

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    return this.prisma.$transaction(async (prisma) => {
      // Create the task first
      const task = await prisma.task.create({
        data: {
          description: createTaskDto.description,
        },
      });

      // Create the initial system message
      await prisma.message.create({
        data: {
          content: {
            type: 'text',
            text: createTaskDto.description,
          },
          type: MessageType.USER,
          taskId: task.id,
        },
      });

      return task;
    });
  }

  async findAll(): Promise<Task[]> {
    return this.prisma.task.findMany();
  }

  async findById(id: string): Promise<Task> {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    await this.findById(id); // Validate task exists before updating

    return this.prisma.task.update({
      where: { id },
      data: updateTaskDto,
    });
  }

  async delete(id: string): Promise<Task> {
    await this.findById(id); // Validate task exists before deleting

    return this.prisma.task.delete({
      where: { id },
    });
  }
}
