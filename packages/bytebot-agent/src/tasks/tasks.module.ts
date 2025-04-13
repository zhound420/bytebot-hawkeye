import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';
import { AGENT_QUEUE_NAME } from '../common/constants';

@Module({
  imports: [
    BullModule.registerQueue({
      name: AGENT_QUEUE_NAME,
    }),
    PrismaModule,
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
