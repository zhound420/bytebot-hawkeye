import { inflateSync } from 'zlib';
import { Coordinates } from './smart-click.types';

export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface Region {
  data: Uint8Array;
  width: number;
  height: number;
  origin: { x: number; y: number };
}

export interface DetectVisualChangeOptions {
  beforeImage: string | Buffer;
  afterImage: string | Buffer;
  center?: Coordinates | null;
  radius?: number;
  threshold?: number;
}

export interface DetectVisualChangeResult {
  changed: boolean;
  confidence: number;
  diff: number;
  threshold: number;
  roi?: Region;
}

export interface DetectClickableElementOptions {
  image: string | Buffer;
  coordinates: Coordinates;
  searchRadius?: number;
}

export async function decodePng(image: string | Buffer): Promise<DecodedImage> {
  const buffer =
    typeof image === 'string' ? Buffer.from(image, 'base64') : image;

  if (buffer.length < 8) {
    throw new Error('Invalid PNG: too small');
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) {
    throw new Error('Invalid PNG signature');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks: Buffer[] = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    const type = buffer.subarray(offset, offset + 4).toString('ascii');
    offset += 4;
    const data = buffer.subarray(offset, offset + length);
    offset += length;
    offset += 4; // skip CRC

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!width || !height) {
    throw new Error('PNG missing IHDR chunk');
  }
  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth}`);
  }
  if (![0, 2, 4, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG color type: ${colorType}`);
  }

  const compressed = Buffer.concat(idatChunks);
  const inflated = inflateSync(compressed);

  const bytesPerPixel = (() => {
    switch (colorType) {
      case 0:
        return 1; // grayscale
      case 2:
        return 3; // RGB
      case 4:
        return 2; // grayscale + alpha
      case 6:
        return 4; // RGBA
      default:
        return 4;
    }
  })();

  const stride = width * bytesPerPixel;
  const expectedLength = (stride + 1) * height;
  if (inflated.length < expectedLength) {
    throw new Error('PNG data truncated');
  }

  const raw = new Uint8Array(width * height * bytesPerPixel);
  let srcOffset = 0;
  let dstOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[srcOffset];
    srcOffset += 1;

    for (let x = 0; x < stride; x += 1) {
      const byte = inflated[srcOffset + x];
      const left = x >= bytesPerPixel ? raw[dstOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? raw[dstOffset - stride + x] : 0;
      const upLeft =
        y > 0 && x >= bytesPerPixel
          ? raw[dstOffset - stride + x - bytesPerPixel]
          : 0;

      let value = 0;
      switch (filterType) {
        case 0:
          value = byte;
          break;
        case 1:
          value = (byte + left) & 0xff;
          break;
        case 2:
          value = (byte + up) & 0xff;
          break;
        case 3:
          value = (byte + Math.floor((left + up) / 2)) & 0xff;
          break;
        case 4:
          value = (byte + paeth(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }

      raw[dstOffset + x] = value;
    }

    srcOffset += stride;
    dstOffset += stride;
  }

  const grayscale = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    switch (colorType) {
      case 0: {
        grayscale[i] = raw[i];
        break;
      }
      case 2: {
        const base = i * bytesPerPixel;
        const r = raw[base];
        const g = raw[base + 1];
        const b = raw[base + 2];
        grayscale[i] = luminance(r, g, b);
        break;
      }
      case 4: {
        const base = i * bytesPerPixel;
        const value = raw[base];
        const alpha = raw[base + 1] / 255;
        grayscale[i] = Math.round(value * alpha);
        break;
      }
      case 6: {
        const base = i * bytesPerPixel;
        const r = raw[base];
        const g = raw[base + 1];
        const b = raw[base + 2];
        const alpha = raw[base + 3] / 255;
        grayscale[i] = Math.round(luminance(r, g, b) * alpha);
        break;
      }
      default: {
        grayscale[i] = raw[i];
      }
    }
  }

  return {
    width,
    height,
    data: grayscale,
  };
}

export function extractRegion(
  image: DecodedImage,
  center: Coordinates,
  radius: number,
): Region {
  const clampedRadius = Math.max(1, Math.floor(radius));
  const width = image.width;
  const height = image.height;

  const cx = clamp(Math.round(center.x), 0, width - 1);
  const cy = clamp(Math.round(center.y), 0, height - 1);

  const left = clamp(cx - clampedRadius, 0, width - 1);
  const top = clamp(cy - clampedRadius, 0, height - 1);
  const roiWidth = Math.min(clampedRadius * 2 + 1, width - left);
  const roiHeight = Math.min(clampedRadius * 2 + 1, height - top);

  const roiData = new Uint8Array(roiWidth * roiHeight);
  for (let y = 0; y < roiHeight; y += 1) {
    for (let x = 0; x < roiWidth; x += 1) {
      const sourceX = left + x;
      const sourceY = top + y;
      roiData[y * roiWidth + x] = image.data[sourceY * width + sourceX];
    }
  }

  return {
    data: roiData,
    width: roiWidth,
    height: roiHeight,
    origin: { x: left, y: top },
  };
}

export function meanAbsoluteDifference(a: Region, b: Region): number {
  if (
    a.width !== b.width ||
    a.height !== b.height ||
    a.data.length !== b.data.length
  ) {
    return Number.POSITIVE_INFINITY;
  }

  let sum = 0;
  const len = a.data.length;
  for (let i = 0; i < len; i += 1) {
    sum += Math.abs(a.data[i] - b.data[i]);
  }
  return sum / len;
}

export async function detectVisualChange(
  options: DetectVisualChangeOptions,
  decoder: (image: string | Buffer) => Promise<DecodedImage> = decodePng,
): Promise<DetectVisualChangeResult> {
  const radius = options.radius ?? 16;
  const thresholdEnv = process.env.BYTEBOT_CLICK_VERIFY_THRESHOLD;
  const threshold =
    options.threshold ?? (thresholdEnv ? Number.parseFloat(thresholdEnv) : 4.0);

  const [before, after] = await Promise.all([
    decoder(options.beforeImage),
    decoder(options.afterImage),
  ]);

  if (!before.width || !before.height || !after.width || !after.height) {
    return { changed: false, confidence: 0, diff: 0, threshold };
  }

  const center = options.center ?? {
    x: Math.round(before.width / 2),
    y: Math.round(before.height / 2),
  };

  const roiA = extractRegion(before, center, radius);
  const roiB = extractRegion(after, center, radius);
  const diff = meanAbsoluteDifference(roiA, roiB);

  if (!Number.isFinite(diff)) {
    return { changed: true, confidence: 1, diff, threshold, roi: roiB };
  }

  const normalized = threshold > 0 ? diff / threshold : diff > 0 ? 1 : 0;
  const confidence = clamp(normalized, 0, 1);
  const changed = diff >= threshold;

  return {
    changed,
    confidence,
    diff,
    threshold,
    roi: roiB,
  };
}

export async function detectClickableElement(
  options: DetectClickableElementOptions,
  decoder: (image: string | Buffer) => Promise<DecodedImage> = decodePng,
): Promise<Coordinates | null> {
  const searchRadius = Math.max(2, Math.floor(options.searchRadius ?? 24));
  const decoded = await decoder(options.image);
  if (!decoded.width || !decoded.height) {
    return null;
  }

  const roi = extractRegion(decoded, options.coordinates, searchRadius);
  if (!roi.width || !roi.height) {
    return null;
  }

  let bestScore = -Infinity;
  let best: Coordinates | null = null;
  const { origin } = roi;

  for (let y = 1; y < roi.height - 1; y += 1) {
    for (let x = 1; x < roi.width - 1; x += 1) {
      const idx = y * roi.width + x;
      const gx = Math.abs(roi.data[idx - 1] - roi.data[idx + 1]);
      const gy = Math.abs(
        roi.data[idx - roi.width] - roi.data[idx + roi.width],
      );
      const gradient = gx + gy;
      const globalX = origin.x + x;
      const globalY = origin.y + y;
      const distance = Math.hypot(
        globalX - options.coordinates.x,
        globalY - options.coordinates.y,
      );
      const distancePenalty = distance / (searchRadius || 1);
      const score = gradient - distancePenalty * 8;

      if (score > bestScore) {
        bestScore = score;
        best = { x: globalX, y: globalY };
      }
    }
  }

  if (!best || bestScore <= 0) {
    return null;
  }

  return best;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function luminance(r: number, g: number, b: number): number {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

function paeth(left: number, up: number, upLeft: number): number {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) {
    return left;
  }
  if (pb <= pc) {
    return up;
  }
  return upLeft;
}
