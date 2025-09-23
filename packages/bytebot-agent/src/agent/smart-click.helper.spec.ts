import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SmartClickHelper } from './smart-click.helper';
import { Coordinates, SmartClickAI } from './smart-click.types';

describe('SmartClickHelper', () => {
  const baseImage = Buffer.from('test-image').toString('base64');
  let originalBaseUrl: string | undefined;

  beforeEach(() => {
    jest.restoreAllMocks();
    originalBaseUrl = process.env.BYTEBOT_DESKTOP_BASE_URL;
    process.env.BYTEBOT_DESKTOP_BASE_URL = 'http://localhost:4000';
  });

  afterEach(() => {
    process.env.BYTEBOT_DESKTOP_BASE_URL = originalBaseUrl;
    jest.restoreAllMocks();
  });

  it('awaits image persistence before emitting progressive telemetry', async () => {
    const deferred = createDeferred<void>();
    const writeFileMock = jest
      .spyOn(fs.promises, 'writeFile')
      .mockImplementation(() => Promise.resolve(undefined));
    writeFileMock
      .mockImplementationOnce(() => Promise.resolve(undefined))
      .mockImplementationOnce(() => Promise.resolve(undefined))
      .mockImplementationOnce(() => deferred.promise);
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve({ ok: true } as any));

    const progressDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-click-'));
    const ai: SmartClickAI = {
      askAboutScreenshot: jest
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({
            global: { x: 40, y: 60 },
            needsZoom: true,
            zoom: { center: { x: 40, y: 60 }, radius: 150 },
            confidence: 0.6,
          }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            global: { x: 50, y: 80 },
            local: { x: 10, y: 20 },
            confidence: 0.92,
            reasoning: 'Target located near overlay crosshair.',
          }),
        ),
      getCoordinates: jest.fn(),
    };

    const helper = new SmartClickHelper(
      ai,
      jest.fn().mockResolvedValue({ image: baseImage }),
      jest.fn().mockResolvedValue({ image: baseImage }),
      { proxyUrl: 'http://proxy', progressDir },
    );

    const smartClickPromise = helper.performSmartClick('Submit button');
    await Promise.resolve();

    expect(hasProgressiveZoomEvent(fetchMock)).toBe(false);

    deferred.resolve();
    await new Promise((resolve) => setImmediate(resolve));

    await smartClickPromise;

    expect(writeFileMock).toHaveBeenCalled();
    expect(hasProgressiveZoomEvent(fetchMock)).toBe(true);

    writeFileMock.mockRestore();
    fetchMock.mockRestore();
  });
});

describe('SmartClickHelper calibration hook', () => {
  const stubScreenshot = jest.fn().mockResolvedValue({ image: 'stub' });
  const stubCustomScreenshot = jest.fn().mockResolvedValue({ image: 'stub' });

  const createHelper = () => {
    const ai: SmartClickAI = {
      askAboutScreenshot: jest.fn().mockResolvedValue('{}'),
      getCoordinates: jest.fn().mockResolvedValue({ x: 0, y: 0 }),
    };

    return new SmartClickHelper(ai, stubScreenshot, stubCustomScreenshot, {
      proxyUrl: 'http://proxy',
      model: 'fake-model',
    });
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('records desktop click successes for calibration', () => {
    const helper = createHelper();
    const coordinateSystem = (helper as any).coordinateSystem;
    helper.recordDesktopClickSuccess({ x: 200, y: 100 });

    const history = coordinateSystem.getCalibrationHistory();
    expect(history).toHaveLength(1);
    expect(history[0].source).toBe('desktop-click-success');
    expect(history[0].success).toBe(true);
    expect(history[0].actual).toEqual({ x: 200, y: 100 });
    expect(history[0].predicted).toEqual({ x: 200, y: 100 });
    expect(history[0].error).toBe(0);
  });

  it('records desktop click corrections and updates calibrator drift', () => {
    const helper = createHelper();
    const coordinateSystem = (helper as any).coordinateSystem;
    expect(coordinateSystem).toBeTruthy();

    const predicted: Coordinates = { x: 120, y: 320 };
    const actual: Coordinates = { x: 127, y: 311 };

    for (let i = 0; i < 12; i += 1) {
      helper.recordDesktopClickCorrection(actual, predicted, true);
    }

    const history = coordinateSystem.getCalibrationHistory();
    expect(history).toHaveLength(12);
    history.forEach((sample: any) => {
      expect(sample.source).toBe('desktop-click');
      expect(sample.success).toBe(true);
      expect(sample.predicted).toEqual(predicted);
      expect(sample.actual).toEqual(actual);
    });

    const calibrator = (coordinateSystem as any).calibrator;
    expect(calibrator.getCurrentOffset()).toEqual({ x: 7, y: -9 });
  });
});

function hasProgressiveZoomEvent(fetchMock: jest.SpyInstance): boolean {
  return fetchMock.mock.calls.some(([, options]) => {
    if (!options || typeof options !== 'object') {
      return false;
    }
    const body = (options as { body?: unknown })?.body;
    if (typeof body !== 'string') {
      return false;
    }
    try {
      const payload = JSON.parse(body);
      return payload.type === 'progressive_zoom';
    } catch {
      return false;
    }
  });
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise,
    resolve: resolve!,
    reject: reject!,
  };
}
