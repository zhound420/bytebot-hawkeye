import {
  MessageContentType,
  RedactedThinkingContentBlock,
  ThinkingContentBlock,
} from '@bytebot/shared';
import {
  estimateMessageTokenCount,
  estimateTokensForBlock,
  estimateTokensFromText,
} from './messages.tokens';

describe('messages.tokens', () => {
  describe('estimateTokensForBlock', () => {
    it('uses textual estimation for thinking blocks', () => {
      const thinking = 'Thought step '.repeat(50);
      const block: ThinkingContentBlock = {
        type: MessageContentType.Thinking,
        thinking,
        signature: 'signature',
      };

      const expected = estimateTokensFromText(thinking);
      const tokens = estimateTokensForBlock(block);

      expect(tokens).toBe(expected);
      expect(tokens).toBeGreaterThan(estimateTokensFromText('thought'));
    });

    it('uses textual estimation for redacted thinking blocks', () => {
      const data = 'REDACTED '.repeat(40);
      const block: RedactedThinkingContentBlock = {
        type: MessageContentType.RedactedThinking,
        data,
      };

      const expected = estimateTokensFromText(data);
      const tokens = estimateTokensForBlock(block);

      expect(tokens).toBe(expected);
      expect(tokens).toBeGreaterThan(0);
    });
  });

  describe('estimateMessageTokenCount', () => {
    it('returns a large count for messages with long thinking content', () => {
      const thinking = 'Deep reasoning step '.repeat(500);
      const block: ThinkingContentBlock = {
        type: MessageContentType.Thinking,
        thinking,
        signature: 'signature',
      };

      const estimate = estimateMessageTokenCount([
        { content: [block] },
      ]);

      const expected = estimateTokensFromText(thinking);

      expect(estimate.totalTokens).toBe(expected);
      expect(estimate.recentWindowTokens).toBe(expected);
      expect(estimate.totalTokens).toBeGreaterThan(2000);
    });
  });
});
