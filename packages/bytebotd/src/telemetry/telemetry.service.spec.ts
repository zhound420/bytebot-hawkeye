import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  let telemetryDir: string;

  beforeEach(async () => {
    telemetryDir = await fs.mkdtemp(path.join(os.tmpdir(), 'telemetry-test-'));
    process.env.BYTEBOT_TELEMETRY_DIR = telemetryDir;
    delete process.env.BYTEBOT_TELEMETRY;
  });

  afterEach(async () => {
    delete process.env.BYTEBOT_TELEMETRY_DIR;
    delete process.env.BYTEBOT_TELEMETRY;
    await fs.rm(telemetryDir, { recursive: true, force: true }).catch(() => undefined);
  });

  it('routes subsequent telemetry to a new session after resetAll', async () => {
    const service = new TelemetryService();
    await service.waitUntilReady();

    await service.resetAll('new-session');
    await service.recordClick({ x: 1, y: 2 }, { x: 1, y: 2 });

    const newSessionLog = await fs.readFile(
      service.getLogFilePath('new-session'),
      'utf8',
    );
    const defaultLog = await fs.readFile(service.getLogFilePath('default'), 'utf8');

    expect(newSessionLog.trim()).not.toHaveLength(0);
    expect(defaultLog.trim()).toHaveLength(0);
  });

  it('summarises session timeline and action events from telemetry logs', async () => {
    const service = new TelemetryService();
    await service.waitUntilReady();

    const logPath = service.getLogFilePath('default');
    const entries = [
      { type: 'action', timestamp: '2024-01-01T00:00:00.000Z', name: 'first' },
      { type: 'untargeted_click', timestamp: '2024-01-01T00:05:00.000Z' },
      {
        type: 'action',
        timestamp: '2024-01-01T00:10:00.000Z',
        name: 'second',
        detail: 'done',
        app: 'should-be-ignored',
      },
    ];
    await fs.writeFile(
      logPath,
      entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n',
      'utf8',
    );

    const summary = await service.getSessionTimeline('default');
    expect(summary.sessionStart).toBe('2024-01-01T00:00:00.000Z');
    expect(summary.sessionEnd).toBe('2024-01-01T00:10:00.000Z');
    expect(summary.sessionDurationMs).toBe(600000);
    expect(summary.events).toEqual([
      {
        type: 'action',
        timestamp: '2024-01-01T00:00:00.000Z',
        metadata: { name: 'first' },
      },
      {
        type: 'action',
        timestamp: '2024-01-01T00:10:00.000Z',
        metadata: { name: 'second', detail: 'done' },
      },
    ]);
  });

  it('includes timeline information when listing sessions', async () => {
    const service = new TelemetryService();
    await service.waitUntilReady();

    const defaultLog = service.getLogFilePath('default');
    await fs.writeFile(
      defaultLog,
      [
        { type: 'action', timestamp: '2024-01-01T00:00:00.000Z' },
        { type: 'action', timestamp: '2024-01-01T00:01:00.000Z' },
      ]
        .map((entry) => JSON.stringify(entry))
        .join('\n') + '\n',
      'utf8',
    );

    await service.startSession('secondary');
    const secondaryLog = service.getLogFilePath('secondary');
    await fs.writeFile(
      secondaryLog,
      JSON.stringify({
        type: 'action',
        timestamp: '2024-01-01T01:00:00.000Z',
      }) + '\n',
      'utf8',
    );

    const { current, sessions } = await service.listSessions();
    expect(current).toBe('secondary');
    const byId = Object.fromEntries(sessions.map((session) => [session.id, session]));

    expect(byId.default).toEqual({
      id: 'default',
      sessionStart: '2024-01-01T00:00:00.000Z',
      sessionEnd: '2024-01-01T00:01:00.000Z',
      sessionDurationMs: 60000,
    });
    expect(byId.secondary).toEqual({
      id: 'secondary',
      sessionStart: '2024-01-01T01:00:00.000Z',
      sessionEnd: '2024-01-01T01:00:00.000Z',
      sessionDurationMs: 0,
    });
  });
});
