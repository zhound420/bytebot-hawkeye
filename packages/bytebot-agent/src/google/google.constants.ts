import { BytebotAgentModel } from '../agent/agent.constants';

export const GOOGLE_MODELS: BytebotAgentModel[] = [
  {
    provider: 'google',
    name: 'gemini-2.5-flash',
    title: 'Gemini 2.5 Flash',
  },
  {
    provider: 'google',
    name: 'gemini-2.5-pro',
    title: 'Gemini 2.5 Pro',
  },
];

export const DEFAULT_MODEL = GOOGLE_MODELS[0];
