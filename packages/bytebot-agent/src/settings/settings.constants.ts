export const SUPPORTED_API_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
] as const;

export type ApiKeyName = (typeof SUPPORTED_API_KEYS)[number];

export type ApiKeyMetadata = {
  configured: boolean;
  length?: number;
  lastFour?: string;
  updatedAt?: string;
};

export type ApiKeyMetadataMap = Record<ApiKeyName, ApiKeyMetadata>;
