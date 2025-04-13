import { Injectable, NotFoundException, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, MessageType, Message, Prisma, TaskStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { AGENT_QUEUE_NAME } from '../common/constants';
import { Queue } from 'bullmq';

@Injectable()
export class TasksService implements OnModuleDestroy {
  constructor(
    @InjectQueue(AGENT_QUEUE_NAME) private agentQueue: Queue,
    readonly prisma: PrismaService,
  ) {}

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
          content: [
            {
              type: 'text',
              text: createTaskDto.description,
            },
          ] as Prisma.InputJsonValue,
          type: MessageType.USER,
          taskId: task.id,
        },
      });
      // Check if there's no in progress tasks
      const inProgressTasks = await prisma.task.findMany({
        where: {
          status: TaskStatus.IN_PROGRESS,
        },
      });
      if (inProgressTasks.length === 0) {
        // Add the task to the queue
        await this.agentQueue.add('task', { taskId: task.id });
      }

      return task;
    });
  }

  async findAll(): Promise<Task[]> {
    return this.prisma.task.findMany();
  }

  async findById(id: string): Promise<Task & { messages: Message[] }> {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        messages: true,
      },
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

  async onModuleDestroy() {
    // Remove all tasks from the queue
    await this.agentQueue.drain();

    // Set any pending tasks to cancelled
    await this.prisma.task.updateMany({
      where: {
        status: TaskStatus.IN_PROGRESS,
      },
      data: {
        status: TaskStatus.CANCELLED,
      },
    });
  }
}
