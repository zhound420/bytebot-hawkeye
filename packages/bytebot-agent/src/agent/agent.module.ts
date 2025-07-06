import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { MessagesModule } from '../messages/messages.module';
import { AnthropicModule } from '../anthropic/anthropic.module';
import { AgentProcessor } from './agent.processor';
import { ConfigModule } from '@nestjs/config';
import { AgentScheduler } from './agent.scheduler';
import { InputCaptureService } from './input-capture.service';
import { OpenAIModule } from '../openai/openai.module';

@Module({
  imports: [
    ConfigModule,
    TasksModule,
    MessagesModule,
    AnthropicModule,
    OpenAIModule,
  ],
  providers: [AgentProcessor, AgentScheduler, InputCaptureService],
  exports: [AgentProcessor],
})
export class AgentModule {}
