import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { MessagesModule } from '../messages/messages.module';
import { AnthropicModule } from '../anthropic/anthropic.module';
import { AgentOrchestratorService } from './agent.orchestrator.service';

@Module({
  imports: [TasksModule, MessagesModule, AnthropicModule],
  providers: [AgentOrchestratorService],
  exports: [AgentOrchestratorService],
})
export class AgentModule {}
