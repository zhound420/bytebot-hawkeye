import { createCanvas } from 'canvas';

type CanvasImageCtor = new () => {
  width: number;
  height: number;
  src: string | any;
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Image }: { Image: CanvasImageCtor } = require('canvas');

type CvModule = Record<string, any>;
export type CvMat = any;

type DecodeOptions = {
  source?: string;
  warnOnce?: (message: string, error?: unknown) => void;
};

export function decodeImageBuffer(
  cvModule: CvModule | null,
  buffer: any,
  options: DecodeOptions = {},
): CvMat {
  if (!cvModule) {
    throw new Error('OpenCV module unavailable while decoding image buffer');
  }

  if (typeof cvModule.imdecode === 'function') {
    return cvModule.imdecode(buffer);
  }

  const source = options.source ?? 'decodeImageBuffer';
  options.warnOnce?.(
    `cv.imdecode unavailable; using canvas fallback for ${source}`,
  );

  return decodeViaCanvas(cvModule, buffer, source);
}

function decodeViaCanvas(cvModule: CvModule, buffer: any, source: string): CvMat {
  try {
    const image = new Image();
    image.src = buffer;

    if (!image.width || !image.height) {
      throw new Error('Decoded image has empty dimensions');
    }

    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    const imageData = ctx.getImageData(0, 0, image.width, image.height);

    if (typeof (cvModule as any).matFromImageData === 'function') {
      return (cvModule as any).matFromImageData(imageData);
    }

    const channels = imageData.data.length / (imageData.width * imageData.height);
    const type = channels === 4
      ? (typeof (cvModule as any).CV_8UC4 === 'number' ? (cvModule as any).CV_8UC4 : 24)
      : (typeof (cvModule as any).CV_8UC3 === 'number' ? (cvModule as any).CV_8UC3 : 16);

    const bufferData = (globalThis as any).Buffer ? (globalThis as any).Buffer.from(imageData.data) : new Uint8Array(imageData.data);
    const mat = new cvModule.Mat(imageData.height, imageData.width, type, bufferData as any);

    if (channels === 4 && typeof (mat as any).cvtColor === 'function') {
      const rgbaToBgr = determineColorConversion(cvModule);
      if (rgbaToBgr !== null) {
        return (mat as any).cvtColor(rgbaToBgr);
      }
    }

    return mat;
  } catch (error) {
    throw new Error(
      `Canvas-based decode failed for ${source}: ${(error as Error)?.message ?? error}`,
    );
  }
}

function determineColorConversion(cvModule: CvModule): number | null {
  if (typeof (cvModule as any).COLOR_RGBA2BGR === 'number') {
    return (cvModule as any).COLOR_RGBA2BGR;
  }
  if (typeof (cvModule as any).COLOR_BGRA2BGR === 'number') {
    return (cvModule as any).COLOR_BGRA2BGR;
  }
  if (typeof (cvModule as any).COLOR_RGBA2RGB === 'number') {
    return (cvModule as any).COLOR_RGBA2RGB;
  }
  return null;
}
