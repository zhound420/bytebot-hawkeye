import { BytebotAgentModel } from 'src/agent/agent.constants';

export const OPENAI_MODELS: BytebotAgentModel[] = [
  {
    provider: 'openai',
    name: 'gpt-4.1-2025-04-14',
    title: 'OpenAIGPT 4.1',
  },
];

export const DEFAULT_MODEL = OPENAI_MODELS[0];
