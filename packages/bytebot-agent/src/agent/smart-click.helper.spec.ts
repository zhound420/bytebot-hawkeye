import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { SmartClickHelper } from './smart-click.helper';
import { SmartClickAI } from './smart-click.types';

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
