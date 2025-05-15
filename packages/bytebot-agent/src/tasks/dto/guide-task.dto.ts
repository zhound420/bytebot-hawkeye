import { IsNotEmpty, IsString } from 'class-validator';

export class GuideTaskDto {
  @IsNotEmpty()
  @IsString()
  message: string;
}
