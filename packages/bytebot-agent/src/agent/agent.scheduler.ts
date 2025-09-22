import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TasksService } from '../tasks/tasks.service';
import { AgentProcessor } from './agent.processor';
import { TaskStatus } from '@prisma/client';
import { FileStorageService } from '../tasks/file-storage.service';
import { getComputerUseClient } from './agent.computer-use';

@Injectable()
export class AgentScheduler implements OnModuleInit {
  private readonly logger = new Logger(AgentScheduler.name);

  constructor(
    private readonly tasksService: TasksService,
    private readonly agentProcessor: AgentProcessor,
    private readonly fileStorageService: FileStorageService,
  ) {}

  async onModuleInit() {
    this.logger.log('AgentScheduler initialized');
    try {
      getComputerUseClient();
    } catch (error) {
      this.logger.warn(
        `Failed to initialize computer use client: ${(error as Error).message}`,
      );
    }
    await this.handleCron();
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    const now = new Date();
    const scheduledTasks = await this.tasksService.findScheduledTasks();
    for (const scheduledTask of scheduledTasks) {
      if (scheduledTask.scheduledFor && scheduledTask.scheduledFor < now) {
        this.logger.debug(
          `Task ID: ${scheduledTask.id} is scheduled for ${scheduledTask.scheduledFor}, queuing it`,
        );
        await this.tasksService.update(scheduledTask.id, {
          queuedAt: now,
        });
      }
    }

    if (this.agentProcessor.isRunning()) {
      return;
    }
    // Find the highest priority task to execute
    const task = await this.tasksService.findNextTask();
    if (task) {
      if (task.files.length > 0) {
        this.logger.debug(
          `Task ID: ${task.id} has files, writing them to the desktop`,
        );
        await this.fileStorageService.writeTaskFilesToDesktop(task.files);
      }

      await this.tasksService.update(task.id, {
        status: TaskStatus.RUNNING,
        executedAt: new Date(),
      });
      this.logger.debug(`Processing task ID: ${task.id}`);
      this.agentProcessor.processTask(task.id);
    }
  }
}
