import {
  MessageContentBlock,
  MessageContentType,
  isMessageContentBlock,
} from '@bytebot/shared';

const CHARACTERS_PER_TOKEN = 4;
const DEFAULT_BLOCK_TOKEN_ESTIMATE = 32;
const IMAGE_BLOCK_TOKEN_ESTIMATE = 1024;
const SCALAR_TOKEN_ESTIMATE = 4;

export interface MessageLike {
  content?: MessageContentBlock[] | null;
}

export interface EstimateMessageTokenCountOptions {
  /**
   * Maximum number of messages to include when calculating the recent window.
   * Defaults to 10 to keep the most recent conversational context.
   */
  recentWindowMessageCount?: number;
  /**
   * Approximate token budget for the recent window. When exceeded we stop
   * including older messages in the recent portion.
   */
  recentWindowTokenLimit?: number;
}

export interface EstimatedMessageTokenCount {
  totalTokens: number;
  recentWindowTokens: number;
  averageTokensPerMessage: number;
  messageCount: number;
}

export function estimateTokensFromText(text?: string | null): number {
  if (!text) {
    return 0;
  }

  const cleaned = text.trim();
  if (!cleaned) {
    return 0;
  }

  return Math.max(1, Math.ceil(cleaned.length / CHARACTERS_PER_TOKEN));
}

export function estimateTokensForBlock(block: MessageContentBlock): number {
  let tokens = 0;

  switch (block.type) {
    case MessageContentType.Text:
      tokens += estimateTokensFromText(block.text);
      break;
    case MessageContentType.Thinking:
      tokens += estimateTokensFromText(block.thinking);
      break;
    case MessageContentType.RedactedThinking:
      tokens += estimateTokensFromText(block.data);
      break;
    case MessageContentType.Image:
      tokens += IMAGE_BLOCK_TOKEN_ESTIMATE;
      break;
    case MessageContentType.Document: {
      const dataTokens = block.source?.data
        ? Math.ceil(block.source.data.length / 8)
        : 0;
      const nameTokens = estimateTokensFromText(block.name);
      tokens += Math.max(dataTokens + nameTokens, DEFAULT_BLOCK_TOKEN_ESTIMATE);
      break;
    }
    case MessageContentType.ToolUse:
      tokens += estimateTokensFromText(block.name);
      tokens += estimateTokensFromText(block.id);
      tokens += estimateTokensFromUnknown(block.input);
      break;
    case MessageContentType.ToolResult:
      tokens += estimateTokensFromText(block.tool_use_id);
      break;
    case MessageContentType.UserAction:
      // User action blocks primarily wrap other content. Use a small base cost
      // to reflect the structural metadata.
      tokens += SCALAR_TOKEN_ESTIMATE;
      break;
    default:
      tokens += estimateTokensFromUnknown(stripContent(block));
      break;
  }

  if (Array.isArray(block.content) && block.content.length > 0) {
    tokens += block.content.reduce(
      (sum, nested) => sum + estimateTokensForBlock(nested),
      0,
    );
  }

  return tokens || DEFAULT_BLOCK_TOKEN_ESTIMATE;
}

export function estimateTokensForMessage(
  content?: MessageContentBlock[] | null,
): number {
  if (!Array.isArray(content)) {
    return 0;
  }

  return content.reduce((sum, block) => sum + estimateTokensForBlock(block), 0);
}

export function estimateMessageTokenCount(
  messages: MessageLike[],
  options: EstimateMessageTokenCountOptions = {},
): EstimatedMessageTokenCount {
  const recentWindowMessageCount = options.recentWindowMessageCount ?? 10;
  const recentWindowTokenLimit = options.recentWindowTokenLimit ?? 4000;

  const messageTokens = messages.map(message =>
    estimateTokensForMessage(message.content),
  );

  const totalTokens = messageTokens.reduce((sum, value) => sum + value, 0);

  let recentWindowTokens = 0;
  let includedMessages = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (includedMessages >= recentWindowMessageCount) {
      break;
    }

    const tokens = messageTokens[index];
    if (recentWindowTokens + tokens > recentWindowTokenLimit) {
      recentWindowTokens = recentWindowTokenLimit;
      break;
    }

    recentWindowTokens += tokens;
    includedMessages += 1;
  }

  recentWindowTokens = Math.min(recentWindowTokens, totalTokens);

  const averageTokensPerMessage =
    messages.length === 0 ? 0 : totalTokens / messages.length;

  return {
    totalTokens,
    recentWindowTokens,
    averageTokensPerMessage,
    messageCount: messages.length,
  };
}

function estimateTokensFromUnknown(value: unknown, visited = new WeakSet<object>()): number {
  if (typeof value === 'string') {
    return estimateTokensFromText(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return SCALAR_TOKEN_ESTIMATE;
  }

  if (Array.isArray(value)) {
    return value.reduce(
      (sum, item) => sum + estimateTokensFromUnknown(item, visited),
      0,
    );
  }

  if (!value || typeof value !== 'object') {
    return 0;
  }

  if (visited.has(value as object)) {
    return 0;
  }

  visited.add(value as object);

  if (isMessageContentBlock(value)) {
    return estimateTokensForBlock(value);
  }

  return Object.values(value).reduce(
    (sum, item) => sum + estimateTokensFromUnknown(item, visited),
    0,
  );
}

function stripContent(block: MessageContentBlock): Record<string, unknown> {
  const { content, ...rest } = block as { content?: unknown } & Record<string, unknown>;
  return rest;
}
