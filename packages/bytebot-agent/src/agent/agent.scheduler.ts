import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TasksService } from '../tasks/tasks.service';
import { AgentProcessor } from './agent.processor';

@Injectable()
export class AgentScheduler implements OnModuleInit {
  private readonly logger = new Logger(AgentScheduler.name);

  constructor(
    private readonly tasksService: TasksService,
    private readonly agentProcessor: AgentProcessor,
  ) {}

  async onModuleInit() {
    this.logger.log('AgentScheduler initialized');
    await this.handleCron();
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async handleCron() {
    if (this.agentProcessor.isRunning()) {
      return;
    }
    // Find the highest priority task to execute
    const task = await this.tasksService.findNextTask();
    if (task) {
      this.logger.debug(`Processing task ID: ${task.id}`);
      await this.agentProcessor.processTask(task.id);
    }
  }
}
