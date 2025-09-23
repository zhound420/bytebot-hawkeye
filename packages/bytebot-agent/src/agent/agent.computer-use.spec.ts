import {
  ComputerToolUseContentBlock,
  MessageContentType,
} from '@bytebot/shared';
import { Logger } from '@nestjs/common';

type AgentModule = typeof import('./agent.computer-use');

let handleComputerToolUse: AgentModule['handleComputerToolUse'];
let parseCoordinateResponse: AgentModule['parseCoordinateResponse'];
let screenshotReminderText: AgentModule['SCREENSHOT_REMINDER_TEXT'];

const logger = {
  debug: jest.fn(),
  error: jest.fn(),
} as unknown as Logger;

let originalFetch: any;

beforeAll(async () => {
  originalFetch = (globalThis as any).fetch;
  process.env.BYTEBOT_DESKTOP_BASE_URL =
    process.env.BYTEBOT_DESKTOP_BASE_URL || 'http://localhost:1234';
  const module = await import('./agent.computer-use');
  handleComputerToolUse = module.handleComputerToolUse;
  parseCoordinateResponse = module.parseCoordinateResponse;
  screenshotReminderText = module.SCREENSHOT_REMINDER_TEXT;
});

afterEach(() => {
  if (originalFetch) {
    (globalThis as any).fetch = originalFetch;
  } else {
    delete (globalThis as any).fetch;
  }
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe('parseCoordinateResponse', () => {
  it('parses JSON coordinate responses', () => {
    const result = parseCoordinateResponse('{"x": 10, "y": 20}');
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('prefers global coordinates when provided in parentheses', () => {
    const result = parseCoordinateResponse(
      'Coordinates: x=120(860), y=40(660)',
    );
    expect(result).toEqual({ x: 860, y: 660 });
  });

  it('prefers explicit global axis tokens when both local and global are present', () => {
    const result = parseCoordinateResponse(
      'local x=120 y=40; global x=860 y=660',
    );
    expect(result).toEqual({ x: 860, y: 660 });
  });

  it('parses coordinate pairs following a global label', () => {
    const result = parseCoordinateResponse(
      'Global coordinates are (860, 660) with local (120, 40)',
    );
    expect(result).toEqual({ x: 860, y: 660 });
  });
});

describe('handleComputerToolUse screenshot reminders', () => {
  it('appends reminder text for full screenshots', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ image: 'base64-image' }),
    });
    (globalThis as any).fetch = fetchMock;

    const block = {
      type: 'tool_use',
      id: 'tool-1',
      name: 'computer_screenshot',
      input: {},
    } as ComputerToolUseContentBlock;

    const result = await handleComputerToolUse(block, logger);

    expect(fetchMock).toHaveBeenCalled();
    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: MessageContentType.Text,
          text: screenshotReminderText,
        }),
      ]),
    );
  });

  it('appends reminder text for focused region screenshots', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        image: 'base64-image',
        offset: { x: 1, y: 2 },
        region: { x: 10, y: 20, width: 100, height: 200 },
        zoomLevel: 2,
      }),
    });
    (globalThis as any).fetch = fetchMock;

    const block = {
      type: 'tool_use',
      id: 'tool-2',
      name: 'computer_screenshot_region',
      input: {
        region: '100,100,200,200',
      },
    } as unknown as ComputerToolUseContentBlock;

    const result = await handleComputerToolUse(block, logger);

    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: MessageContentType.Text,
          text: screenshotReminderText,
        }),
      ]),
    );
  });

  it('appends reminder text for custom region screenshots', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        image: 'base64-image',
        region: { x: 5, y: 5, width: 50, height: 50 },
      }),
    });
    (globalThis as any).fetch = fetchMock;

    const block = {
      type: 'tool_use',
      id: 'tool-3',
      name: 'computer_screenshot_custom_region',
      input: {
        x: 5,
        y: 5,
        width: 50,
        height: 50,
      },
    } as unknown as ComputerToolUseContentBlock;

    const result = await handleComputerToolUse(block, logger);

    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: MessageContentType.Text,
          text: screenshotReminderText,
        }),
      ]),
    );
  });
});

describe('handleComputerToolUse clicks', () => {
  it('defaults clickCount to 1 when omitted', async () => {
    const fetchMock = jest.fn().mockImplementation((_, options) => {
      const payload = (() => {
        try {
          return options?.body
            ? JSON.parse((options as { body: string }).body)
            : {};
        } catch {
          return {};
        }
      })();
      if (payload.action === 'screenshot') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ image: 'stub-image' }),
        });
      }
      if (payload.action === 'click_mouse') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      });
    });
    (globalThis as any).fetch = fetchMock;

    const block = {
      type: 'tool_use',
      id: 'click-1',
      name: 'computer_click_mouse',
      input: {
        button: 'left',
        coordinates: { x: 100, y: 200 },
      },
    } as unknown as ComputerToolUseContentBlock;

    await handleComputerToolUse(block, logger);

    expect(fetchMock).toHaveBeenCalledWith(
      `${process.env.BYTEBOT_DESKTOP_BASE_URL}/computer-use`,
      expect.objectContaining({
        method: 'POST',
        body: expect.any(String),
      }),
    );
    const clickCall = fetchMock.mock.calls.find(([, options]) => {
      try {
        const payload = JSON.parse((options as { body: string }).body);
        return payload.action === 'click_mouse';
      } catch {
        return false;
      }
    });
    expect(clickCall).toBeDefined();
    const [, options] = clickCall!;
    const body = JSON.parse((options as { body: string }).body);
    expect(body.clickCount).toBe(1);
  });
});
