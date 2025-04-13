import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { MessagesModule } from '../messages/messages.module';
import { AnthropicModule } from '../anthropic/anthropic.module';
import { AgentProcessor } from './agent.processor';
import { BullModule } from '@nestjs/bullmq';
import { AGENT_QUEUE_NAME } from '../common/constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: AGENT_QUEUE_NAME,
    }),
    TasksModule,
    MessagesModule,
    AnthropicModule,
  ],
  providers: [AgentProcessor],
  exports: [AgentProcessor],
})
export class AgentModule {}
