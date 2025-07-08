import { BytebotAgentModel } from 'src/agent/agent.constants';

export const OPENAI_MODELS: BytebotAgentModel[] = [
  {
    provider: 'openai',
    name: 'gpt-4.1-2025-04-14',
    title: 'GPT-4.1',
  },
  {
    provider: 'openai',
    name: 'gpt-4o-2024-05-13',
    title: 'GPT-4o',
  },
];

export const DEFAULT_MODEL = OPENAI_MODELS[0];
