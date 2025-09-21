import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyName } from '@prisma/client';

import { ApiKeysService } from '../settings/api-keys.service';
import { BytebotAgentModel } from '../agent/agent.types';
import { ANTHROPIC_MODELS } from '../anthropic/anthropic.constants';
import { OPENAI_MODELS } from '../openai/openai.constants';
import { GOOGLE_MODELS } from '../google/google.constants';

interface ProviderAvailabilityConfig {
  key: ApiKeyName;
  envVar: string;
  models: BytebotAgentModel[];
}

const PROVIDERS: ProviderAvailabilityConfig[] = [
  {
    key: ApiKeyName.ANTHROPIC_API_KEY,
    envVar: 'ANTHROPIC_API_KEY',
    models: ANTHROPIC_MODELS,
  },
  {
    key: ApiKeyName.OPENAI_API_KEY,
    envVar: 'OPENAI_API_KEY',
    models: OPENAI_MODELS,
  },
  {
    key: ApiKeyName.GEMINI_API_KEY,
    envVar: 'GEMINI_API_KEY',
    models: GOOGLE_MODELS,
  },
  {
    key: ApiKeyName.OPENROUTER_API_KEY,
    envVar: 'OPENROUTER_API_KEY',
    models: [],
  },
];

@Injectable()
export class ModelAvailabilityService {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly configService: ConfigService,
  ) {}

  async listAvailableModels(): Promise<BytebotAgentModel[]> {
    const configured = new Set<ApiKeyName>(
      await this.apiKeysService.getConfiguredKeyNames(),
    );

    for (const { key, envVar } of PROVIDERS) {
      if (this.configService.get<string>(envVar)) {
        configured.add(key);
      }
    }

    const availableModels: BytebotAgentModel[] = [];

    for (const { key, models } of PROVIDERS) {
      if (!models.length) {
        continue;
      }

      if (configured.has(key)) {
        availableModels.push(...models);
      }
    }

    return availableModels;
  }
}
