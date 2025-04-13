import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, Message, MessageRole, Prisma, TaskStatus } from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { AGENT_QUEUE_NAME } from '../common/constants';
import { Queue } from 'bullmq';

@Injectable()
export class TasksService implements OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectQueue(AGENT_QUEUE_NAME) private agentQueue: Queue,
    readonly prisma: PrismaService,
  ) {
    this.logger.log('TasksService initialized');
  }

  async create(createTaskDto: CreateTaskDto): Promise<Task> {
    this.logger.log(
      `Creating new task with description: ${createTaskDto.description}`,
    );

    return this.prisma.$transaction(async (prisma) => {
      // Create the task first
      this.logger.debug('Creating task record in database');
      const task = await prisma.task.create({
        data: {
          description: createTaskDto.description,
        },
      });
      this.logger.log(`Task created successfully with ID: ${task.id}`);

      // Create the initial system message
      this.logger.debug(`Creating initial message for task ID: ${task.id}`);
      await prisma.message.create({
        data: {
          content: [
            {
              type: 'text',
              text: createTaskDto.description,
            },
          ] as Prisma.InputJsonValue,
          role: MessageRole.USER,
          taskId: task.id,
        },
      });
      this.logger.debug(`Initial message created for task ID: ${task.id}`);

      // Check if there's no in progress tasks
      this.logger.debug('Checking for in-progress tasks');
      const inProgressTasks = await prisma.task.findMany({
        where: {
          status: TaskStatus.IN_PROGRESS,
        },
      });

      if (inProgressTasks.length === 0) {
        // Add the task to the queue
        this.logger.log(
          `No tasks in progress, adding task ID: ${task.id} to agent queue`,
        );

        // Update task status to IN_PROGRESS
        await prisma.task.update({
          where: { id: task.id },
          data: { status: TaskStatus.IN_PROGRESS },
        });

        await this.agentQueue.add('task', { taskId: task.id });
        this.logger.debug(
          `Task ID: ${task.id} added to agent queue successfully`,
        );
      } else {
        this.logger.log(
          `Found ${inProgressTasks.length} tasks in progress, new task ID: ${task.id} will wait in queue`,
        );
      }

      return task;
    });
  }

  async findAll(): Promise<Task[]> {
    this.logger.log('Retrieving all tasks');
    const tasks = await this.prisma.task.findMany();
    this.logger.debug(`Retrieved ${tasks.length} tasks`);
    return tasks;
  }

  async findInProgress(): Promise<Task | null> {
    this.logger.log('Searching for in-progress task');
    const task = await this.prisma.task.findFirst({
      where: {
        status: TaskStatus.IN_PROGRESS,
      },
    });

    if (task) {
      this.logger.debug(`Found in-progress task with ID: ${task.id}`);
    } else {
      this.logger.debug('No in-progress tasks found');
    }

    return task;
  }

  async findById(id: string): Promise<Task & { messages: Message[] }> {
    this.logger.log(`Retrieving task by ID: ${id}`);

    try {
      const task = await this.prisma.task.findUnique({
        where: { id },
        include: {
          messages: true,
        },
      });

      if (!task) {
        this.logger.warn(`Task with ID: ${id} not found`);
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      this.logger.debug(
        `Successfully retrieved task ID: ${id} with ${task.messages.length} messages`,
      );
      return task;
    } catch (error) {
      this.logger.error(
        `Error retrieving task ID: ${id} - ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async update(id: string, updateTaskDto: UpdateTaskDto): Promise<Task> {
    this.logger.log(`Updating task with ID: ${id}`);
    this.logger.debug(`Update data: ${JSON.stringify(updateTaskDto)}`);

    try {
      // Validate task exists before updating
      const existingTask = await this.findById(id);

      if (!existingTask) {
        this.logger.warn(`Task with ID: ${id} not found for update`);
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      const updatedTask = await this.prisma.task.update({
        where: { id },
        data: updateTaskDto,
      });

      this.logger.log(`Successfully updated task ID: ${id}`);
      this.logger.debug(`Updated task: ${JSON.stringify(updatedTask)}`);

      return updatedTask;
    } catch (error) {
      this.logger.error(
        `Error updating task ID: ${id} - ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async delete(id: string): Promise<Task> {
    this.logger.log(`Deleting task with ID: ${id}`);

    try {
      // Validate task exists before deleting
      const task = await this.findById(id);

      if (!task) {
        this.logger.warn(`Task with ID: ${id} not found for deletion`);
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      const deletedTask = await this.prisma.task.delete({
        where: { id },
      });

      this.logger.log(`Successfully deleted task ID: ${id}`);

      return deletedTask;
    } catch (error) {
      this.logger.error(
        `Error deleting task ID: ${id} - ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    this.logger.log('TasksService shutting down, cleaning up resources');

    // Remove all tasks from the queue
    this.logger.debug('Draining agent queue');
    await this.agentQueue.drain();
    this.logger.debug('Agent queue drained successfully');

    // Set any pending tasks to cancelled
    this.logger.debug('Updating in-progress tasks to cancelled status');
    const result = await this.prisma.task.updateMany({
      where: {
        status: TaskStatus.IN_PROGRESS,
      },
      data: {
        status: TaskStatus.CANCELLED,
      },
    });

    this.logger.log(
      `Set ${result.count} in-progress tasks to cancelled status`,
    );
    this.logger.log('TasksService shutdown complete');
  }
}
