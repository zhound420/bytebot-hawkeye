import { HttpException } from '@nestjs/common';

import { TasksController } from './tasks.controller';

describe('TasksController', () => {
  let controller: TasksController;
  const tasksService = {} as any;
  const messagesService = {} as any;

  beforeEach(() => {
    controller = new TasksController(tasksService, messagesService);
    process.env.BYTEBOT_DESKTOP_BASE_URL = 'http://localhost:4300';
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
    delete process.env.BYTEBOT_DESKTOP_BASE_URL;
    delete process.env.BYTEBOT_LLM_PROXY_URL;
  });

  describe('telemetrySessions', () => {
    it('normalizes daemon session summaries and preserves timeline metadata', async () => {
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            current: 'session-a',
            sessions: [
              {
                id: 'session-a',
                sessionStart: '2024-07-01T00:00:00.000Z',
                sessionEnd: '2024-07-01T00:05:00.000Z',
                sessionDurationMs: 300_000,
              },
              {
                id: 'session-b',
                sessionStart: null,
                sessionEnd: null,
                sessionDurationMs: null,
              },
            ],
          }),
        } as unknown as Response);

      const result = await controller.telemetrySessions();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:4300/telemetry/sessions',
      );
      expect(result.current?.id).toBe('session-a');
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].sessionDurationMs).toBe(300_000);
      expect(result.sessions[0].startedAt).toBe('2024-07-01T00:00:00.000Z');
      expect(result.sessions[0].endedAt).toBe('2024-07-01T00:05:00.000Z');
      expect(result.sessions[1].sessionDurationMs).toBeNull();
    });

    it('creates a placeholder session when daemon omits metadata for the active id', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          current: 'session-c',
          sessions: [],
        }),
      } as unknown as Response);

      const result = await controller.telemetrySessions();

      expect(result.current?.id).toBe('session-c');
      expect(result.current?.label).toBe('session-c');
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].sessionDurationMs).toBeNull();
      expect(result.sessions[0].startedAt).toBeNull();
    });

    it('propagates fetch failures as HTTP exceptions', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: false,
        statusText: 'Bad Gateway',
      } as unknown as Response);

      await expect(controller.telemetrySessions()).rejects.toBeInstanceOf(
        HttpException,
      );
    });
  });

  describe('getModels', () => {
    it('returns proxy models when proxy responds with model_list', async () => {
      process.env.BYTEBOT_LLM_PROXY_URL = 'http://proxy.local';
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          model_list: [
            {
              model_name: 'Proxy GPT',
              litellm_params: {
                model: 'proxy/gpt-4',
              },
              model_info: {
                supports_vision: true,
              },
            },
          ],
        }),
      } as unknown as Response);

      const result = await controller.getModels();

      expect(fetchMock).toHaveBeenCalledWith(
        'http://proxy.local/model/info',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(result).toEqual([
        {
          provider: 'proxy',
          name: 'proxy/gpt-4',
          title: 'Proxy GPT',
          contextWindow: 128000,
          supportsVision: true,
        },
      ]);
    });
  });
});
