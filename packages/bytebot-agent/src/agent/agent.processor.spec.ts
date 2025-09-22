import { AgentProcessor } from './agent.processor';
import { TaskStatus } from '@prisma/client';
import { SCREENSHOT_OBSERVATION_GUARD_MESSAGE } from './agent.constants';
import { MessageContentType } from '@bytebot/shared';

jest.mock('./agent.computer-use', () => ({
  handleComputerToolUse: jest.fn(),
}));

import { handleComputerToolUse } from './agent.computer-use';

describe('AgentProcessor', () => {
  const createProcessor = (overrides: Partial<Record<string, any>> = {}) => {
    const tasksService = {
      findById: jest.fn().mockResolvedValue({
        id: 'task-1',
        status: TaskStatus.RUNNING,
        model: { provider: 'anthropic', name: 'claude-3', contextWindow: 100 },
      }),
      update: jest.fn(),
      create: jest.fn(),
      ...overrides.tasksService,
    };
    const messagesService = {
      findUnsummarized: jest.fn().mockResolvedValue([]),
      findEvery: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      attachSummary: jest.fn(),
      ...overrides.messagesService,
    };
    const summariesService = {
      findLatest: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      ...overrides.summariesService,
    };
    const anthropicService = {
      generateMessage: jest.fn(),
      ...overrides.anthropicService,
    };
    const openaiService = {
      generateMessage: jest.fn(),
      ...overrides.openaiService,
    };
    const googleService = {
      generateMessage: jest.fn(),
      ...overrides.googleService,
    };
    const proxyService = {
      generateMessage: jest.fn(),
      ...overrides.proxyService,
    };
    const inputCaptureService = {
      start: jest.fn(),
      stop: jest.fn(),
      ...overrides.inputCaptureService,
    };

    const processor = new AgentProcessor(
      tasksService as any,
      messagesService as any,
      summariesService as any,
      anthropicService as any,
      openaiService as any,
      googleService as any,
      proxyService as any,
      inputCaptureService as any,
    );

    return {
      processor,
      tasksService,
      messagesService,
      summariesService,
      anthropicService,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canMarkCompleted', () => {
    it('returns true when message lookup fails', async () => {
      const { processor, messagesService } = createProcessor({
        messagesService: {
          findEvery: jest.fn().mockRejectedValue(new Error('db unreachable')),
        },
      });

      const result = await (processor as any).canMarkCompleted('task-1');

      expect(messagesService.findEvery).toHaveBeenCalledWith('task-1');
      expect(result).toBe(true);
    });

    it('rejects completion when verification happens before the latest action', async () => {
      const base = new Date('2024-01-01T00:00:00Z');
      const history = [
        {
          id: 'msg-1',
          createdAt: base,
          updatedAt: base,
          content: [
            {
              type: MessageContentType.ToolResult,
              tool_use_id: 'tool-1',
              content: [
                {
                  type: MessageContentType.Image,
                },
              ],
            },
          ],
        },
        {
          id: 'msg-2',
          createdAt: new Date(base.getTime() + 1000),
          updatedAt: new Date(base.getTime() + 1000),
          content: [
            {
              type: MessageContentType.ToolUse,
              id: 'tool-2',
              name: 'computer_click_mouse',
              input: {},
            },
          ],
        },
      ];

      const { processor } = createProcessor({
        messagesService: {
          findUnsummarized: jest.fn().mockResolvedValue([]),
          findEvery: jest.fn().mockResolvedValue(history as any),
          create: jest.fn(),
          attachSummary: jest.fn(),
        },
      });

      const result = await (processor as any).canMarkCompleted('task-1');

      expect(result).toBe(false);
    });

    it('allows completion when verification follows the final action', async () => {
      const base = new Date('2024-01-01T00:05:00Z');
      const history = [
        {
          id: 'msg-1',
          createdAt: base,
          updatedAt: base,
          content: [
            {
              type: MessageContentType.ToolUse,
              id: 'tool-1',
              name: 'computer_click_mouse',
              input: {},
            },
          ],
        },
        {
          id: 'msg-2',
          createdAt: new Date(base.getTime() + 1000),
          updatedAt: new Date(base.getTime() + 1000),
          content: [
            {
              type: MessageContentType.ToolResult,
              tool_use_id: 'tool-1',
              content: [
                {
                  type: MessageContentType.Image,
                },
              ],
            },
          ],
        },
      ];

      const { processor } = createProcessor({
        messagesService: {
          findUnsummarized: jest.fn().mockResolvedValue([]),
          findEvery: jest.fn().mockResolvedValue(history as any),
          create: jest.fn(),
          attachSummary: jest.fn(),
        },
      });

      const result = await (processor as any).canMarkCompleted('task-1');

      expect(result).toBe(true);
    });
  });

  describe('runIteration', () => {
    it('allows desktop actions after a text observation clears the screenshot gate', async () => {
      const screenshotResponse = {
        contentBlocks: [
          {
            id: 'tool-1',
            type: MessageContentType.ToolUse,
            name: 'computer_screenshot',
            input: {},
          },
        ],
        tokenUsage: { totalTokens: 0 },
      };

      const followUpResponse = {
        contentBlocks: [
          {
            id: 'text-1',
            type: MessageContentType.Text,
            text: 'Observation of the desktop',
          },
          {
            id: 'tool-2',
            type: MessageContentType.ToolUse,
            name: 'computer_click_mouse',
            input: { x: 100, y: 200, button: 'left' },
          },
        ],
        tokenUsage: { totalTokens: 0 },
      };

      const anthropicService = {
        generateMessage: jest
          .fn()
          .mockResolvedValueOnce(screenshotResponse)
          .mockResolvedValueOnce(followUpResponse),
      };

      const messagesService = {
        findUnsummarized: jest.fn().mockResolvedValue([]),
        findEvery: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        attachSummary: jest.fn(),
      };

      const handleComputerToolUseMock =
        handleComputerToolUse as unknown as jest.MockedFunction<
          typeof handleComputerToolUse
        >;
      handleComputerToolUseMock
        .mockResolvedValueOnce({
          type: MessageContentType.ToolResult,
          tool_use_id: 'tool-1',
          content: [],
        })
        .mockResolvedValueOnce({
          type: MessageContentType.ToolResult,
          tool_use_id: 'tool-2',
          content: [],
        });

      const { processor } = createProcessor({
        messagesService,
        anthropicService,
      });

      (processor as any).isProcessing = true;
      (processor as any).abortController = new AbortController();

      const setImmediateSpy = jest
        .spyOn(global, 'setImmediate')
        .mockImplementation(((cb: (...args: any[]) => void) => {
          return null as any;
        }) as any);

      try {
        await (processor as any).runIteration('task-1');
        await (processor as any).runIteration('task-1');

        expect(handleComputerToolUseMock).toHaveBeenCalledTimes(2);
        expect(handleComputerToolUseMock.mock.calls[1][0].name).toBe(
          'computer_click_mouse',
        );
        expect((processor as any).pendingScreenshotObservation).toBe(false);
      } finally {
        setImmediateSpy.mockRestore();
      }
    });

    it('rejects computer tool calls that follow a screenshot without an observation', async () => {
      const screenshotResponse = {
        contentBlocks: [
          {
            id: 'tool-1',
            type: MessageContentType.ToolUse,
            name: 'computer_screenshot',
            input: {},
          },
        ],
        tokenUsage: { totalTokens: 0 },
      };

      const nonCompliantResponse = {
        contentBlocks: [
          {
            id: 'tool-2',
            type: MessageContentType.ToolUse,
            name: 'computer_click_mouse',
            input: { x: 100, y: 200, button: 'left' },
          },
        ],
        tokenUsage: { totalTokens: 0 },
      };

      const anthropicService = {
        generateMessage: jest
          .fn()
          .mockResolvedValueOnce(screenshotResponse)
          .mockResolvedValueOnce(nonCompliantResponse),
      };

      const messagesService = {
        findUnsummarized: jest.fn().mockResolvedValue([]),
        findEvery: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        attachSummary: jest.fn(),
      };

      const handleComputerToolUseMock =
        handleComputerToolUse as unknown as jest.MockedFunction<
          typeof handleComputerToolUse
        >;
      handleComputerToolUseMock.mockResolvedValue({
        type: MessageContentType.ToolResult,
        tool_use_id: 'tool-1',
        content: [],
      });

      const { processor } = createProcessor({
        messagesService,
        anthropicService,
      });

      (processor as any).isProcessing = true;
      (processor as any).abortController = new AbortController();

      const setImmediateSpy = jest
        .spyOn(global, 'setImmediate')
        .mockImplementation(((cb: (...args: any[]) => void) => {
          return null as any;
        }) as any);

      try {
        await (processor as any).runIteration('task-1');
        await (processor as any).runIteration('task-1');

        expect(handleComputerToolUseMock).toHaveBeenCalledTimes(1);
        const toolResultCall =
          messagesService.create.mock.calls[messagesService.create.mock.calls.length - 1][0];
        expect(toolResultCall.content[0].is_error).toBe(true);
        expect(toolResultCall.content[0].content[0].text).toBe(
          SCREENSHOT_OBSERVATION_GUARD_MESSAGE,
        );
        expect((processor as any).pendingScreenshotObservation).toBe(true);
      } finally {
        setImmediateSpy.mockRestore();
      }
    });

    it('marks the task completed when canMarkCompleted falls back to true', async () => {
      const anthropicResponse = {
        contentBlocks: [
          {
            id: 'set-status-1',
            type: 'tool_use',
            name: 'set_task_status',
            input: {
              status: 'completed',
              description: 'All done',
            },
          },
        ],
        tokenUsage: {
          totalTokens: 0,
        },
      };

      const { processor, tasksService, messagesService, anthropicService } = createProcessor({
        messagesService: {
          findUnsummarized: jest.fn().mockResolvedValue([]),
          findEvery: jest.fn().mockRejectedValue(new Error('transient failure')),
          create: jest.fn(),
        },
        anthropicService: {
          generateMessage: jest.fn().mockResolvedValue(anthropicResponse),
        },
      });

      (processor as any).isProcessing = true;
      (processor as any).abortController = new AbortController();

      const setImmediateSpy = jest
        .spyOn(global, 'setImmediate')
        .mockImplementation(((cb: (...args: any[]) => void) => {
          // Do not reschedule iterations during the test
          return null as any;
        }) as any);

      try {
        await (processor as any).runIteration('task-1');

        expect(anthropicService.generateMessage).toHaveBeenCalled();
        expect(messagesService.findEvery).toHaveBeenCalledWith('task-1');
        expect(tasksService.update).toHaveBeenCalledWith('task-1', {
          status: TaskStatus.COMPLETED,
          completedAt: expect.any(Date),
        });
      } finally {
        setImmediateSpy.mockRestore();
      }
    });
  });

  describe('set_task_status tool handling', () => {
    it('marks the task failed when requested via tool use', async () => {
      const anthropicResponse = {
        contentBlocks: [
          {
            id: 'set-status-1',
            type: 'tool_use',
            name: 'set_task_status',
            input: {
              status: 'failed',
              description: 'Encountered an unrecoverable error',
            },
          },
        ],
        tokenUsage: {
          totalTokens: 0,
        },
      };

      const { processor, tasksService, anthropicService } = createProcessor({
        tasksService: {
          findById: jest.fn().mockResolvedValue({
            id: 'task-1',
            status: TaskStatus.RUNNING,
            executedAt: undefined,
            model: { provider: 'anthropic', name: 'claude-3', contextWindow: 100 },
          }),
        },
        anthropicService: {
          generateMessage: jest.fn().mockResolvedValue(anthropicResponse),
        },
      });

      (processor as any).isProcessing = true;
      (processor as any).abortController = new AbortController();

      const setImmediateSpy = jest
        .spyOn(global, 'setImmediate')
        .mockImplementation(((cb: (...args: any[]) => void) => {
          return null as any;
        }) as any);

      try {
        await (processor as any).runIteration('task-1');

        expect(anthropicService.generateMessage).toHaveBeenCalled();
        expect(tasksService.update).toHaveBeenCalledWith('task-1', {
          status: TaskStatus.FAILED,
          completedAt: expect.any(Date),
          executedAt: expect.any(Date),
        });
      } finally {
        setImmediateSpy.mockRestore();
      }
    });
  });
});
