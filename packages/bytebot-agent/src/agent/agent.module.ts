import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { MessagesModule } from '../messages/messages.module';
import { AnthropicModule } from '../anthropic/anthropic.module';
import { AgentProcessor } from './agent.processor';
import { ConfigModule } from '@nestjs/config';
import { AgentScheduler } from './agent.scheduler';
import { InputCaptureService } from './input-capture.service';

@Module({
  imports: [ConfigModule, TasksModule, MessagesModule, AnthropicModule],
  providers: [AgentProcessor, AgentScheduler, InputCaptureService],
  exports: [AgentProcessor],
})
export class AgentModule {}
