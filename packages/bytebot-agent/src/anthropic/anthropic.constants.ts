export interface Model {
  provider: string;
  name: string;
  title: string;
}

export const AVAILABLE_MODELS: Model[] = [
  {
    provider: 'anthropic',
    name: 'claude-opus-4-20250514',
    title: 'Claude Opus 4',
  },
  {
    provider: 'anthropic',
    name: 'claude-3-sonnet-20240229',
    title: 'Claude 3 Sonnet',
  },
  {
    provider: 'anthropic',
    name: 'claude-3-haiku-20240307',
    title: 'Claude 3 Haiku',
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS[0];