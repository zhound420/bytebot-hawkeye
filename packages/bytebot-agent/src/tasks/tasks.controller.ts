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
import { Message, Task } from '@prisma/client';
import { AddTaskMessageDto } from './dto/add-task-message.dto';
import { MessagesService } from '../messages/messages.service';
import { ANTHROPIC_MODELS } from '../anthropic/anthropic.constants';
import { OPENAI_MODELS } from '../openai/openai.constants';
import { GOOGLE_MODELS } from '../google/google.constants';
import { BytebotAgentModel } from 'src/agent/agent.types';

type AgentTelemetrySessionInfo = {
  id: string;
  label: string;
  startedAt: string | null;
  endedAt: string | null;
  lastEventAt: string | null;
  eventCount?: number;
  sessionStart: string | null;
  sessionEnd: string | null;
  sessionDurationMs: number | null;
};

const geminiApiKey = process.env.GEMINI_API_KEY;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

const proxyUrl = process.env.BYTEBOT_LLM_PROXY_URL;

const models = [
  ...(anthropicApiKey ? ANTHROPIC_MODELS : []),
  ...(openaiApiKey ? OPENAI_MODELS : []),
  ...(geminiApiKey ? GOOGLE_MODELS : []),
];

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly messagesService: MessagesService,
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
  async getModels() {
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
          (model: any) => {
            const supportsVision =
              model.supports_vision === true ||
              model.litellm_params?.supports_vision === true ||
              model.litellm_params?.supports_image_input === true;

            return {
              provider: 'proxy',
              name: model.litellm_params.model,
              title: model.model_name,
              contextWindow: 128000,
              supportsVision,
            } satisfies BytebotAgentModel;
          },
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
    return models;
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

  private normalizeTelemetrySession(input: unknown): AgentTelemetrySessionInfo | null {
    if (!input || typeof input !== 'object') {
      if (typeof input === 'string' && input.trim().length > 0) {
        const id = input.trim();
        return {
          id,
          label: id,
          startedAt: null,
          endedAt: null,
          lastEventAt: null,
          sessionStart: null,
          sessionEnd: null,
          sessionDurationMs: null,
        };
      }
      return null;
    }

    const candidate = input as Record<string, unknown>;
    const idSource = candidate.id ?? candidate.sessionId ?? candidate.identifier;
    const id =
      typeof idSource === 'string' && idSource.trim().length > 0
        ? idSource.trim()
        : null;
    if (!id) {
      return null;
    }

    const label =
      typeof candidate.label === 'string' && candidate.label.trim().length > 0
        ? candidate.label
        : id;
    const startedAtCandidate =
      typeof candidate.startedAt === 'string' && candidate.startedAt.length > 0
        ? candidate.startedAt
        : null;
    const endedAtCandidate =
      typeof candidate.endedAt === 'string' && candidate.endedAt.length > 0
        ? candidate.endedAt
        : null;
    const sessionStart =
      typeof candidate.sessionStart === 'string' &&
      candidate.sessionStart.length > 0
        ? candidate.sessionStart
        : startedAtCandidate;
    const sessionEnd =
      typeof candidate.sessionEnd === 'string' &&
      candidate.sessionEnd.length > 0
        ? candidate.sessionEnd
        : endedAtCandidate;
    const lastEventAt =
      typeof candidate.lastEventAt === 'string' &&
      candidate.lastEventAt.length > 0
        ? candidate.lastEventAt
        : sessionEnd ?? endedAtCandidate ?? null;
    const eventCount =
      typeof candidate.eventCount === 'number' &&
      Number.isFinite(candidate.eventCount)
        ? candidate.eventCount
        : undefined;
    const sessionDurationMs =
      typeof candidate.sessionDurationMs === 'number' &&
      Number.isFinite(candidate.sessionDurationMs)
        ? candidate.sessionDurationMs
        : null;

    return {
      id,
      label,
      startedAt: sessionStart ?? startedAtCandidate,
      endedAt: sessionEnd ?? endedAtCandidate,
      lastEventAt,
      eventCount,
      sessionStart: sessionStart ?? null,
      sessionEnd: sessionEnd ?? null,
      sessionDurationMs,
    };
  }

  @Get('telemetry/sessions')
  async telemetrySessions(): Promise<{
    current: AgentTelemetrySessionInfo | null;
    sessions: AgentTelemetrySessionInfo[];
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
      const normalizedSessions = Array.isArray(payload.sessions)
        ? payload.sessions
            .map((session) => this.normalizeTelemetrySession(session))
            .filter(
              (session): session is AgentTelemetrySessionInfo => session !== null,
            )
        : [];

      const sessionMap = new Map<string, AgentTelemetrySessionInfo>();
      for (const session of normalizedSessions) {
        sessionMap.set(session.id, session);
      }

      const currentCandidate = this.normalizeTelemetrySession(payload.current);
      let current: AgentTelemetrySessionInfo | null = null;
      if (currentCandidate) {
        const existing = sessionMap.get(currentCandidate.id);
        current = existing ?? currentCandidate;
        if (!existing) {
          sessionMap.set(currentCandidate.id, currentCandidate);
        }
      }

      const sessions: AgentTelemetrySessionInfo[] = [];
      const seen = new Set<string>();
      if (current) {
        sessions.push(current);
        seen.add(current.id);
      }
      for (const session of sessionMap.values()) {
        if (seen.has(session.id)) {
          continue;
        }
        sessions.push(session);
        seen.add(session.id);
      }

      return {
        current,
        sessions,
      };
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
