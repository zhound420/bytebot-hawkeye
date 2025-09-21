import { AgentProcessor } from './agent.processor';
import { TaskStatus } from '@prisma/client';

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

    return { processor, tasksService, messagesService, summariesService, anthropicService };
  };

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
  });

  describe('runIteration', () => {
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
