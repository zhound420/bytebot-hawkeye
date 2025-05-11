import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BullModule } from '@nestjs/bullmq';
import { AgentModule } from './agent/agent.module';
import { TasksModule } from './tasks/tasks.module';
import { MessagesModule } from './messages/messages.module';
import { AnthropicModule } from './anthropic/anthropic.module';
import { PrismaModule } from './prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { Redis } from 'ioredis';

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: new Redis(process.env.REDIS_URL || 'redis://redis:6379'),
        maxRetriesPerRequest: null
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AgentModule,
    TasksModule,
    MessagesModule,
    AnthropicModule,
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
