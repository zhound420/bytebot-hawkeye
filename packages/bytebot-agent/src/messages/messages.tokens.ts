import { Message } from '@prisma/client';
import { MessageContentBlock, MessageContentType } from '@bytebot/shared';

export type TokenizedMessage = Message & { estimatedTokens: number };

const MIN_TOKENS_PER_MESSAGE = 4;
const AVG_CHARS_PER_TOKEN = 4;
const TOOL_BLOCK_TOKEN_WEIGHT = 48;

const estimateTokensFromText = (text: string): number => {
  if (!text) {
    return MIN_TOKENS_PER_MESSAGE;
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) {
    return MIN_TOKENS_PER_MESSAGE;
  }

  return Math.max(
    MIN_TOKENS_PER_MESSAGE,
    Math.ceil(normalized.length / AVG_CHARS_PER_TOKEN),
  );
};

const estimateTokensForBlock = (block: MessageContentBlock): number => {
  switch (block.type) {
    case MessageContentType.Text: {
      const textBlock = block as { text?: string };
      return estimateTokensFromText(textBlock.text || '');
    }
    case MessageContentType.ToolResult: {
      const nested = (block.content || []) as MessageContentBlock[];
      const nestedTokens = nested.reduce(
        (sum, child) => sum + estimateTokensForBlock(child),
        0,
      );
      return TOOL_BLOCK_TOKEN_WEIGHT + nestedTokens;
    }
    case MessageContentType.ToolUse: {
      const serialized = JSON.stringify((block as any).input || {});
      return TOOL_BLOCK_TOKEN_WEIGHT + estimateTokensFromText(serialized);
    }
    case MessageContentType.UserAction: {
      const nested = (block.content || []) as MessageContentBlock[];
      return (
        TOOL_BLOCK_TOKEN_WEIGHT +
        nested.reduce((sum, child) => sum + estimateTokensForBlock(child), 0)
      );
    }
    default:
      return TOOL_BLOCK_TOKEN_WEIGHT;
  }
};

export const estimateMessageTokenCount = (
  content: MessageContentBlock[],
): number => {
  if (!content || content.length === 0) {
    return MIN_TOKENS_PER_MESSAGE;
  }

  const total = content.reduce(
    (sum, block) => sum + estimateTokensForBlock(block),
    0,
  );

  return Math.max(MIN_TOKENS_PER_MESSAGE, total);
};

export const normalizeMessageTokens = (
  message: Message & { estimatedTokens?: number },
): TokenizedMessage => {
  const contentBlocks = (message.content || []) as MessageContentBlock[];
  const estimatedTokens =
    message.estimatedTokens && message.estimatedTokens > 0
      ? message.estimatedTokens
      : estimateMessageTokenCount(contentBlocks);

  if (estimatedTokens === message.estimatedTokens) {
    return message as TokenizedMessage;
  }

  return {
    ...message,
    estimatedTokens,
  } as TokenizedMessage;
};
