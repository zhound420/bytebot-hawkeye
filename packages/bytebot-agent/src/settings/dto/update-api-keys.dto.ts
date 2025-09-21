import { IsOptional, IsString } from 'class-validator';

export class UpdateApiKeysDto {
  @IsOptional()
  @IsString()
  ANTHROPIC_API_KEY?: string;

  @IsOptional()
  @IsString()
  OPENAI_API_KEY?: string;

  @IsOptional()
  @IsString()
  GEMINI_API_KEY?: string;

  @IsOptional()
  @IsString()
  OPENROUTER_API_KEY?: string;
}
