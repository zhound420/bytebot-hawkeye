import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  Query,
  HttpException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ApiKeyName, Message, Task } from '@prisma/client';
import { AddTaskMessageDto } from './dto/add-task-message.dto';
import { MessagesService } from '../messages/messages.service';
import { ANTHROPIC_MODELS } from '../anthropic/anthropic.constants';
import { OPENAI_MODELS } from '../openai/openai.constants';
import { GOOGLE_MODELS } from '../google/google.constants';
import { BytebotAgentModel } from 'src/agent/agent.types';
import { ApiKeysService } from '../settings/api-keys.service';
import { ConfigService } from '@nestjs/config';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly messagesService: MessagesService,
    private readonly apiKeysService: ApiKeysService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createTaskDto: CreateTaskDto): Promise<Task> {
    return this.tasksService.create(createTaskDto);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('statuses') statuses?: string,
  ): Promise<{ tasks: Task[]; total: number; totalPages: number }> {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    // Handle both single status and multiple statuses
    let statusFilter: string[] | undefined;
    if (statuses) {
      statusFilter = statuses.split(',');
    } else if (status) {
      statusFilter = [status];
    }

    return this.tasksService.findAll(pageNum, limitNum, statusFilter);
  }

  @Get('models')
  async getModels(): Promise<BytebotAgentModel[]> {
    const proxyUrl = this.configService.get<string>('BYTEBOT_LLM_PROXY_URL');

    if (proxyUrl) {
      try {
        const response = await fetch(`${proxyUrl}/model/info`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new HttpException(
            `Failed to fetch models from proxy: ${response.statusText}`,
            HttpStatus.BAD_GATEWAY,
          );
        }

        const proxyModels = await response.json();

        // Map proxy response to BytebotAgentModel format
        const models: BytebotAgentModel[] = proxyModels.data.map(
          (model: any) => ({
            provider: 'proxy',
            name: model.litellm_params.model,
            title: model.model_name,
            contextWindow: 128000,
          }),
        );

        return models;
      } catch (error) {
        if (error instanceof HttpException) {
          throw error;
        }
        throw new HttpException(
          `Error fetching models: ${error.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
    const configuredNames = await this.apiKeysService.getConfiguredKeyNames();
    const configured = new Set<ApiKeyName>(configuredNames);

    const fallbackEnvVars: Array<[ApiKeyName, string]> = [
      [ApiKeyName.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY'],
      [ApiKeyName.OPENAI_API_KEY, 'OPENAI_API_KEY'],
      [ApiKeyName.GEMINI_API_KEY, 'GEMINI_API_KEY'],
    ];

    for (const [name, envVar] of fallbackEnvVars) {
      if (this.configService.get<string>(envVar)) {
        configured.add(name);
      }
    }

    const availableModels: BytebotAgentModel[] = [];

    if (configured.has(ApiKeyName.ANTHROPIC_API_KEY)) {
      availableModels.push(...ANTHROPIC_MODELS);
    }
    if (configured.has(ApiKeyName.OPENAI_API_KEY)) {
      availableModels.push(...OPENAI_MODELS);
    }
    if (configured.has(ApiKeyName.GEMINI_API_KEY)) {
      availableModels.push(...GOOGLE_MODELS);
    }

    return availableModels;
  }

  @Get('telemetry/summary')
  async telemetrySummary(
    @Query('app') app?: string,
    @Query('limit') limit?: string,
    @Query('session') session?: string,
  ) {
    const base = process.env.BYTEBOT_DESKTOP_BASE_URL;
    if (!base) {
      throw new HttpException(
        'Desktop base URL not configured',
        HttpStatus.BAD_GATEWAY,
      );
    }
    const qs: string[] = [];
    if (app) qs.push(`app=${encodeURIComponent(app)}`);
    if (limit) qs.push(`limit=${encodeURIComponent(limit)}`);
    if (session) qs.push(`session=${encodeURIComponent(session)}`);
    const url = `${base}/telemetry/summary${qs.length ? `?${qs.join('&')}` : ''}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new HttpException(
          `Failed to fetch telemetry: ${res.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return await res.json();
    } catch (e: any) {
      throw new HttpException(
        `Error fetching telemetry: ${e.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Get('telemetry/apps')
  async telemetryApps(
    @Query('limit') limit?: string,
    @Query('window') window?: string,
    @Query('session') session?: string,
  ) {
    const base = process.env.BYTEBOT_DESKTOP_BASE_URL;
    if (!base) {
      throw new HttpException(
        'Desktop base URL not configured',
        HttpStatus.BAD_GATEWAY,
      );
    }
    const qs: string[] = [];
    if (limit) qs.push(`limit=${encodeURIComponent(limit)}`);
    if (window) qs.push(`window=${encodeURIComponent(window)}`);
    if (session) qs.push(`session=${encodeURIComponent(session)}`);
    const url = `${base}/telemetry/apps${qs.length ? `?${qs.join('&')}` : ''}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new HttpException(
          `Failed to fetch apps: ${res.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return await res.json();
    } catch (e: any) {
      throw new HttpException(
        `Error fetching apps: ${e.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Post('telemetry/reset')
  async telemetryReset(@Query('session') session?: string) {
    const base = process.env.BYTEBOT_DESKTOP_BASE_URL;
    if (!base) {
      throw new HttpException(
        'Desktop base URL not configured',
        HttpStatus.BAD_GATEWAY,
      );
    }
    const url = `${base}/telemetry/reset${
      session ? `?session=${encodeURIComponent(session)}` : ''
    }`;
    try {
      const res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        throw new HttpException(
          `Failed to reset telemetry: ${res.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      return await res.json();
    } catch (e: any) {
      throw new HttpException(
        `Error resetting telemetry: ${e.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Get('telemetry/sessions')
  async telemetrySessions(): Promise<{
    current: string | null;
    sessions: string[];
  }> {
    const base = process.env.BYTEBOT_DESKTOP_BASE_URL;
    if (!base) {
      throw new HttpException(
        'Desktop base URL not configured',
        HttpStatus.BAD_GATEWAY,
      );
    }
    const url = `${base}/telemetry/sessions`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new HttpException(
          `Failed to fetch sessions: ${res.statusText}`,
          HttpStatus.BAD_GATEWAY,
        );
      }
      const payload = (await res.json()) as {
        current?: unknown;
        sessions?: unknown;
      };
      const sessions = Array.isArray(payload.sessions)
        ? Array.from(
            new Set(
              payload.sessions.filter(
                (session): session is string =>
                  typeof session === 'string' && session.length > 0,
              ),
            ),
          )
        : [];
      const current =
        typeof payload.current === 'string' && payload.current.length > 0
          ? payload.current
          : null;
      if (current && !sessions.includes(current)) {
        sessions.unshift(current);
      }
      return { current, sessions };
    } catch (e: any) {
      throw new HttpException(
        `Error fetching sessions: ${e.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Task> {
    return this.tasksService.findById(id);
  }

  @Get(':id/messages')
  async taskMessages(
    @Param('id') taskId: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ): Promise<Message[]> {
    const options = {
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
    };

    const messages = await this.messagesService.findAll(taskId, options);
    return messages;
  }

  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  async addTaskMessage(
    @Param('id') taskId: string,
    @Body() guideTaskDto: AddTaskMessageDto,
  ): Promise<Task> {
    return this.tasksService.addTaskMessage(taskId, guideTaskDto);
  }

  @Get(':id/messages/raw')
  async taskRawMessages(
    @Param('id') taskId: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ): Promise<Message[]> {
    const options = {
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
    };

    return this.messagesService.findRawMessages(taskId, options);
  }

  @Get(':id/messages/processed')
  async taskProcessedMessages(
    @Param('id') taskId: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    const options = {
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
    };

    return this.messagesService.findProcessedMessages(taskId, options);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.tasksService.delete(id);
  }

  @Post(':id/takeover')
  @HttpCode(HttpStatus.OK)
  async takeOver(@Param('id') taskId: string): Promise<Task> {
    return this.tasksService.takeOver(taskId);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  async resume(@Param('id') taskId: string): Promise<Task> {
    return this.tasksService.resume(taskId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('id') taskId: string): Promise<Task> {
    return this.tasksService.cancel(taskId);
  }
}
