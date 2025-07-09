import { BytebotAgentModel } from '../agent/agent.constants';

export const ANTHROPIC_MODELS: BytebotAgentModel[] = [
  {
    provider: 'anthropic',
    name: 'claude-opus-4-20250514',
    title: 'Claude Opus 4',
  },
  {
    provider: 'anthropic',
    name: 'claude-sonnet-4-20250514',
    title: 'Claude Sonnet 4',
  },
];

export const DEFAULT_MODEL = ANTHROPIC_MODELS[0];
