import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { PrismaModule } from '../prisma/prisma.module';
import { MessagesModule } from 'src/messages/messages.module';

@Module({
  imports: [PrismaModule, MessagesModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
