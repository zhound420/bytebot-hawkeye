import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TasksGateway } from './tasks.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagesModule } from '../messages/messages.module';
import { ApiKeysModule } from '../settings/api-keys.module';

@Module({
  imports: [PrismaModule, MessagesModule, ApiKeysModule],
  controllers: [TasksController],
  providers: [TasksService, TasksGateway],
  exports: [TasksService, TasksGateway],
})
export class TasksModule {}
