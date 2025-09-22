import { AgentProcessor } from './agent.processor';
import { TaskStatus, Role } from '@prisma/client';
import {
  MessageContentType,
  SCREENSHOT_OBSERVATION_GUARD_MESSAGE,
} from '@bytebot/shared';

jest.mock('@anthropic-ai/claude-code', () => ({
  query: jest.fn(),
}));

import { query } from '@anthropic-ai/claude-code';

type QueryMock = jest.MockedFunction<typeof query>;

const createStream = (messages: any[]): AsyncIterable<any> => ({
  async *[Symbol.asyncIterator]() {
    for (const message of messages) {
      yield message;
    }
  },
});

describe('AgentProcessor (Claude Code)', () => {
  const createProcessor = () => {
    const tasksService = {
      findById: jest.fn().mockResolvedValue({
        id: 'task-1',
        status: TaskStatus.RUNNING,
        description: 'Do the thing',
      }),
      update: jest.fn(),
    };

    const messagesService = {
      create: jest.fn().mockResolvedValue(null),
    };

    const inputCaptureService = {
      start: jest.fn(),
      stop: jest.fn(),
    };

    const processor = new AgentProcessor(
      tasksService as any,
      messagesService as any,
      inputCaptureService as any,
    );

    return { processor, tasksService, messagesService };
  };

  let queryMock: QueryMock;

  beforeEach(() => {
    jest.clearAllMocks();
    queryMock = query as QueryMock;
  });

  it('clears the screenshot observation gate after a compliant observation reply', async () => {
    const screenshotMessage = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'mcp__desktop__computer_screenshot',
            input: {},
          },
        ],
      },
    };

    const compliantMessage = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'text',
            text: 'Observed the desktop UI and listed the key regions.',
          },
          {
            type: 'tool_use',
            id: 'tool-2',
            name: 'mcp__desktop__computer_click_mouse',
            input: { x: 100, y: 200, button: 'left' },
          },
        ],
      },
    };

    queryMock.mockReturnValueOnce(
      createStream([screenshotMessage, compliantMessage]) as any,
    );

    const { processor, messagesService } = createProcessor();
    (processor as any).isProcessing = true;

    await (processor as any).runIteration('task-1');

    expect(messagesService.create).toHaveBeenCalled();
    expect((processor as any).pendingScreenshotObservation).toBe(false);
    const assistantPayloads = messagesService.create.mock.calls
      .filter(([payload]: any[]) => payload.role === Role.ASSISTANT)
      .map(([payload]: any[]) => payload);
    expect(assistantPayloads[assistantPayloads.length - 1].content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: MessageContentType.ToolUse,
          id: 'tool-2',
        }),
      ]),
    );
  });

  it('emits an error tool result when a computer action follows a screenshot without an observation', async () => {
    const screenshotMessage = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'mcp__desktop__computer_screenshot',
            input: {},
          },
        ],
      },
    };

    const nonObservantMessage = {
      type: 'assistant',
      message: {
        content: [
          {
            type: 'tool_use',
            id: 'tool-2',
            name: 'mcp__desktop__computer_click_mouse',
            input: { x: 50, y: 75, button: 'left' },
          },
        ],
      },
    };

    queryMock.mockReturnValueOnce(
      createStream([screenshotMessage, nonObservantMessage]) as any,
    );

    const { processor, messagesService } = createProcessor();
    (processor as any).isProcessing = true;

    await (processor as any).runIteration('task-1');

    const guardCall = messagesService.create.mock.calls.find(
      ([payload]: any[]) => payload.role === Role.USER,
    );
    expect(guardCall).toBeDefined();
    const [payload] = guardCall as any[];
    expect(payload.content[0].is_error).toBe(true);
    expect(payload.content[0].content[0].text).toBe(
      SCREENSHOT_OBSERVATION_GUARD_MESSAGE,
    );
    expect((processor as any).pendingScreenshotObservation).toBe(true);
  });
});
