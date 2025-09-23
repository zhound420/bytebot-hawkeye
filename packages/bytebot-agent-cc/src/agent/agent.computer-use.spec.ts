import type { Logger } from '@nestjs/common';

process.env.BYTEBOT_DESKTOP_BASE_URL = 'http://desktop';

const { handleComputerToolUse } = require('./agent.computer-use') as typeof import('./agent.computer-use');

const TOOL_USE = 'tool_use';
const TEXT = 'text';

const createLogger = (): Logger =>
  ({
    debug: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    verbose: jest.fn(),
    setContext: jest.fn(),
  } as unknown as Logger);

describe('performClick helper', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(async (_url: string, options?: any) => {
      const body = options?.body
        ? JSON.parse(options.body as string)
        : { action: undefined };

      if (body.action === 'click_mouse') {
        return {
          ok: true,
          json: jest.fn().mockResolvedValue(null),
        } as any;
      }

      if (body.action === 'screenshot') {
        return {
          ok: true,
          json: jest.fn().mockResolvedValue({ image: 'base64-image' }),
        } as any;
      }

      return {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      } as any;
    });

    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends description-only clicks to the desktop service', async () => {
    const block = {
      type: TOOL_USE,
      id: 'tool-1',
      name: 'computer_click_mouse',
      input: {
        button: 'left',
        clickCount: 1,
        description: '  Click confirm submit button  ',
        context: {
          targetDescription: 'Confirm submit',
          source: 'manual',
        },
      },
    } as any;

    await handleComputerToolUse(block, createLogger());

    expect(fetchMock).toHaveBeenCalled();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://desktop/computer-use');
    expect(options?.method).toBe('POST');
    const payload = JSON.parse((options?.body as string) ?? '{}');
    expect(payload).toEqual({
      action: 'click_mouse',
      button: 'left',
      clickCount: 1,
      description: 'Click confirm submit button',
      context: {
        targetDescription: 'Confirm submit',
        source: 'manual',
      },
    });
  });

  it('rejects clicks without coordinates or a valid description', async () => {
    const block = {
      type: TOOL_USE,
      id: 'tool-2',
      name: 'computer_click_mouse',
      input: {
        button: 'left',
        clickCount: 1,
        description: 'submit',
      },
    } as any;

    const result = await handleComputerToolUse(block, createLogger());
    expect(result.is_error).toBe(true);
    const textContent = result.content.find(
      (item: any) => item.type === TEXT,
    );
    expect(textContent).toBeDefined();
    expect(textContent?.type).toBe(TEXT);
    expect((textContent as any).text).toContain(
      'Click rejected: target description must be between 3 and 6 words.',
    );
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
