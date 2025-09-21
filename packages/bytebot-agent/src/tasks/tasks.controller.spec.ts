import { Test, TestingModule } from '@nestjs/testing';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { MessagesService } from '../messages/messages.service';
import { ApiKeysService } from '../settings/api-keys.service';
import { ApiKeyName } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { ANTHROPIC_MODELS } from '../anthropic/anthropic.constants';
import { OPENAI_MODELS } from '../openai/openai.constants';
import { GOOGLE_MODELS } from '../google/google.constants';

class InMemoryApiKeysService {
  private configured = new Set<ApiKeyName>();

  async getConfiguredKeyNames(): Promise<ApiKeyName[]> {
    return Array.from(this.configured);
  }

  setConfigured(names: ApiKeyName[] = []) {
    this.configured = new Set(names);
  }
}

class MutableConfigService {
  private values = new Map<string, string>();

  get<T = any>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  set(key: string, value?: string) {
    if (typeof value === 'undefined') {
      this.values.delete(key);
    } else {
      this.values.set(key, value);
    }
  }
}

describe('TasksController - getModels', () => {
  let controller: TasksController;
  let apiKeysService: InMemoryApiKeysService;
  let configService: MutableConfigService;

  beforeEach(async () => {
    apiKeysService = new InMemoryApiKeysService();
    configService = new MutableConfigService();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: { create: jest.fn(), findAll: jest.fn() } },
        { provide: MessagesService, useValue: {} },
        { provide: ApiKeysService, useValue: apiKeysService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get<TasksController>(TasksController);
  });

  it('reflects persisted API key changes without restart', async () => {
    await expect(controller.getModels()).resolves.toEqual([]);

    apiKeysService.setConfigured([ApiKeyName.ANTHROPIC_API_KEY]);
    await expect(controller.getModels()).resolves.toEqual(ANTHROPIC_MODELS);

    apiKeysService.setConfigured([ApiKeyName.OPENAI_API_KEY]);
    await expect(controller.getModels()).resolves.toEqual(OPENAI_MODELS);

    apiKeysService.setConfigured([
      ApiKeyName.ANTHROPIC_API_KEY,
      ApiKeyName.GEMINI_API_KEY,
    ]);
    await expect(controller.getModels()).resolves.toEqual([
      ...ANTHROPIC_MODELS,
      ...GOOGLE_MODELS,
    ]);

    apiKeysService.setConfigured([]);
    configService.set('OPENAI_API_KEY', 'from-env');
    await expect(controller.getModels()).resolves.toEqual(OPENAI_MODELS);

    configService.set('OPENAI_API_KEY');
  });
});
