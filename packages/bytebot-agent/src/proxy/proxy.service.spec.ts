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

  it('retains resolved tool calls while flagging unresolved ones after screenshot message', () => {
    const service = createService();

    const messages: ChatCompletionMessageParam[] = [
      {
        role: 'assistant',
        content: 'Initiating tools...',
        tool_calls: [
          {
            id: 'call_1',
            type: 'function',
            function: {
              name: 'takeScreenshot',
              arguments: '{}',
            },
          },
          {
            id: 'call_2',
            type: 'function',
            function: {
              name: 'fetchData',
              arguments: '{"query":"status"}',
            },
          },
        ],
      } as any,
      {
        role: 'tool',
        tool_call_id: 'call_1',
        content: 'screenshot',
      } as any,
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Screenshot' },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/png;base64,AAA',
              detail: 'high',
            },
          },
        ],
      } as any,
    ];

    const sanitized = (service as any).sanitizeChatMessages(messages);

    expect(sanitized).toHaveLength(3);
    const assistant = sanitized[0] as any;

    expect(Array.isArray(assistant.tool_calls)).toBe(true);
    expect(assistant.tool_calls).toHaveLength(1);
    expect(assistant.tool_calls[0].id).toBe('call_1');

    const assistantContent =
      typeof assistant.content === 'string'
        ? assistant.content
        : JSON.stringify(assistant.content);

    expect(assistantContent).toContain('[tool-call:fetchData] unresolved');
  });
});
