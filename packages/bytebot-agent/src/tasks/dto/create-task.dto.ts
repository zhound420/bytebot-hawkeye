import { IsDate, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TaskPriority, TaskType } from '@prisma/client';

export class CreateTaskDto {
  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  type?: TaskType;

  @IsOptional()
  @IsDate()
  scheduledFor?: Date;

  @IsOptional()
  @IsString()
  priority?: TaskPriority;
}
