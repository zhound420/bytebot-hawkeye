import {
  handleComputerToolUse,
  parseCoordinateResponse,
  SCREENSHOT_REMINDER_TEXT,
} from './agent.computer-use';
import {
  ComputerToolUseContentBlock,
  MessageContentType,
} from '@bytebot/shared';
import { Logger } from '@nestjs/common';

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
  const logger = {
    debug: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;
  let originalFetch: any;
  let originalFallback: string | undefined;

  beforeAll(() => {
    originalFetch = (globalThis as any).fetch;
    process.env.BYTEBOT_DESKTOP_BASE_URL =
      process.env.BYTEBOT_DESKTOP_BASE_URL || 'http://localhost:1234';
    originalFallback = process.env.BYTEBOT_COMPUTER_USE_HTTP_FALLBACK;
    process.env.BYTEBOT_COMPUTER_USE_HTTP_FALLBACK = 'true';
  });

  afterEach(() => {
    if (originalFetch) {
      (globalThis as any).fetch = originalFetch;
    } else {
      delete (globalThis as any).fetch;
    }
    jest.restoreAllMocks();
  });

  afterAll(() => {
    if (originalFallback === undefined) {
      delete process.env.BYTEBOT_COMPUTER_USE_HTTP_FALLBACK;
    } else {
      process.env.BYTEBOT_COMPUTER_USE_HTTP_FALLBACK = originalFallback;
    }
  });

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
          text: SCREENSHOT_REMINDER_TEXT,
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
          text: SCREENSHOT_REMINDER_TEXT,
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
          text: SCREENSHOT_REMINDER_TEXT,
        }),
      ]),
    );
  });
});
