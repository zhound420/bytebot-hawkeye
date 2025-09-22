import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  queuedAt?: Date;

  @IsOptional()
  executedAt?: Date;

  @IsOptional()
  completedAt?: Date;

  @IsOptional()
  @IsInt()
  @Min(0)
  iterationsSinceSummary?: number;

  @IsOptional()
  @IsString()
  lastSummarizedMessageId?: string;
}
