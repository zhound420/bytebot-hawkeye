jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
  APIUserAbortError: class {},
}));

jest.mock(
  '@bytebot/shared',
  () => ({
    MessageContentType: {
      Text: 'text',
      ToolUse: 'tool_use',
      ToolResult: 'tool_result',
      Image: 'image',
      Thinking: 'thinking',
    },
    isUserActionContentBlock: jest.fn().mockReturnValue(false),
    isComputerToolUseContentBlock: jest.fn().mockReturnValue(false),
    isImageContentBlock: jest.fn().mockReturnValue(false),
  }),
  { virtual: true },
);

import { ConfigService } from '@nestjs/config';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { ProxyService } from './proxy.service';

describe('ProxyService sanitizeChatMessages', () => {
  const createService = () => {
    const configService = {
      get: jest.fn().mockReturnValue('http://localhost'),
    } as unknown as ConfigService;
    return new ProxyService(configService);
  };

  it('removes unresolved tool calls when user message follows', () => {
    const service = createService();

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'assistant',
        content: 'Working...',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'doSomething',
              arguments: '{}',
            },
          },
        ],
      } as any,
      {
        role: 'user',
        content: 'Next step',
      },
    ];

    const sanitized = (service as any).sanitizeChatMessages(messages);

    expect(sanitized).toHaveLength(2);
    expect((sanitized[0] as any).tool_calls).toBeUndefined();

    const serializedContent =
      typeof sanitized[0].content === 'string'
        ? sanitized[0].content
        : JSON.stringify(sanitized[0].content);

    expect(serializedContent).toContain('[tool-call:doSomething] unresolved');
  });
});
