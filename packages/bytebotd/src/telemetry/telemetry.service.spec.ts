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
});
