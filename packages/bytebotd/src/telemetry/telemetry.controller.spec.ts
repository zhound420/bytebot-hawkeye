import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { TelemetryController } from './telemetry.controller';
import {
  InvalidSessionIdError,
  SessionSummaryInfo,
  TelemetryActionEventSummary,
  TelemetryService,
} from './telemetry.service';

describe('TelemetryController', () => {
  it('passes trimmed session from request body to resetAll', async () => {
    const resetAll = jest.fn().mockResolvedValue(undefined);
    const telemetry = {
      resetAll,
    } as unknown as TelemetryService;

    const controller = new TelemetryController(telemetry);

    await controller.reset(undefined, '  session-from-body  ');

    expect(resetAll).toHaveBeenCalledWith('session-from-body');
  });

  it('includes session timeline data in summary response', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'telemetry-controller-'));
    try {
      const logPath = path.join(tempDir, 'click-telemetry.log');
      const calibrationDir = path.join(tempDir, 'calibration');
      await fs.mkdir(calibrationDir, { recursive: true });
      await fs.writeFile(
        logPath,
        [
          {
            target: { x: 0, y: 0 },
            actual: { x: 1, y: -1 },
            delta: { x: 1, y: -1 },
            timestamp: '2024-01-01T00:00:00.000Z',
          },
        ]
          .map((entry) => JSON.stringify(entry))
          .join('\n') + '\n',
        'utf8',
      );
      await fs.writeFile(path.join(calibrationDir, 'snapshot.png'), 'data', 'utf8');

      const timeline = {
        sessionStart: '2024-01-01T00:00:00.000Z',
        sessionEnd: '2024-01-01T00:05:00.000Z',
        sessionDurationMs: 300000,
        events: [
          {
            type: 'action',
            timestamp: '2024-01-01T00:01:00.000Z',
            metadata: { name: 'demo' },
          },
        ] as TelemetryActionEventSummary[],
      };

      const telemetry = {
        getLogFilePath: jest.fn().mockReturnValue(logPath),
        getCalibrationDir: jest.fn().mockReturnValue(calibrationDir),
        getSessionTimeline: jest.fn().mockResolvedValue(timeline),
      } as unknown as TelemetryService;

      const controller = new TelemetryController(telemetry);

      const summary = await controller.summary();
      expect(summary.sessionStart).toBe(timeline.sessionStart);
      expect(summary.sessionEnd).toBe(timeline.sessionEnd);
      expect(summary.sessionDurationMs).toBe(timeline.sessionDurationMs);
      expect(summary.events).toEqual(timeline.events);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('counts smart click completion without double counting raw payload', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'telemetry-controller-'));
    try {
      const logPath = path.join(tempDir, 'click-telemetry.log');
      const calibrationDir = path.join(tempDir, 'calibration');
      await fs.mkdir(calibrationDir, { recursive: true });
      const entries = [
        {
          target: { x: 0, y: 0 },
          actual: { x: 4, y: 0 },
          delta: { x: 4, y: 0 },
          clickTaskId: 'task-1',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
        {
          type: 'smart_click_complete',
          delta: { x: 4, y: 0 },
          distance: 4,
          success: true,
          clickTaskId: 'task-1',
          timestamp: '2024-01-01T00:00:01.000Z',
        },
      ];
      await fs.writeFile(
        logPath,
        entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
        'utf8',
      );

      const telemetry = {
        getLogFilePath: jest.fn().mockReturnValue(logPath),
        getCalibrationDir: jest.fn().mockReturnValue(calibrationDir),
        getSessionTimeline: jest.fn().mockResolvedValue({
          sessionStart: null,
          sessionEnd: null,
          sessionDurationMs: null,
          events: [],
        }),
      } as unknown as TelemetryService;

      const controller = new TelemetryController(telemetry);

      const summary = await controller.summary();
      expect(summary.targetedClicks).toBe(1);
      expect(summary.smartClicks).toBe(1);
      expect(summary.recentAbsDeltas).toEqual([4]);
      expect(summary.avgAbsDelta).toBe(4);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('returns session summaries from telemetry service', async () => {
    const sessions: SessionSummaryInfo[] = [
      {
        id: 'default',
        sessionStart: '2024-01-01T00:00:00.000Z',
        sessionEnd: '2024-01-01T00:01:00.000Z',
        sessionDurationMs: 60000,
      },
    ];
    const telemetry = {
      listSessions: jest.fn().mockResolvedValue({ current: 'default', sessions }),
    } as unknown as TelemetryService;

    const controller = new TelemetryController(telemetry);

    await expect(controller.sessions()).resolves.toEqual({
      current: 'default',
      sessions,
    });
  });

  it('returns a 400 response when summary receives an invalid session id', async () => {
    const telemetry = {
      getLogFilePath: jest.fn(() => {
        throw new InvalidSessionIdError('../evil');
      }),
      getSessionTimeline: jest.fn(),
      getCalibrationDir: jest.fn(),
    } as unknown as TelemetryService;

    const controller = new TelemetryController(telemetry);

    await expect(controller.summary(undefined, undefined, '../evil')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('returns a 400 response when reset receives an invalid session id', async () => {
    const telemetry = {
      resetAll: jest
        .fn()
        .mockRejectedValue(new InvalidSessionIdError('../evil')),
    } as unknown as TelemetryService;

    const controller = new TelemetryController(telemetry);

    await expect(controller.reset('../evil')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
