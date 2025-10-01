import { createWorker, Worker } from 'tesseract.js';
import { BoundingBox, DetectedElement, ElementType } from '../../types';
import { decodeImageBuffer } from '../../utils/cv-decode';
import { getOpenCvModule, hasOpenCv, logOpenCvWarning } from '../../utils/opencv-loader';

interface RecognizeRectangleOption {
  rectangle: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

const cv: any = getOpenCvModule();
const hasCv = hasOpenCv();

logOpenCvWarning('OCRDetector');

const toErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return stripStack(error.message);
  }
  if (typeof error === 'string') {
    return stripStack(error);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const stripStack = (message: string | undefined): string => {
  if (!message) {
    return '';
  }
  const [firstLine] = message.split('\n');
  return firstLine?.trim() ?? '';
};

const warnedMessages = new Set<string>();
let filter2DSupported: boolean | null = null;

// Morphology provider system
type MorphologyProviderResult = {
  instance: any;
  method: string;
  source: string;
  operation: string;
};

let morphologyProvider: (() => MorphologyProviderResult) | null = null;
let morphologyCapabilityDetected = false;

const warn = (message: string, error?: unknown): void => {
  if (error !== undefined) {
    // eslint-disable-next-line no-console
    console.warn(`[OCRDetector] ${message}: ${toErrorMessage(error)}`);
  } else {
    // eslint-disable-next-line no-console
    console.warn(`[OCRDetector] ${message}`);
  }
};

const warnOnce = (message: string, error?: unknown): void => {
  if (warnedMessages.has(message)) {
    return;
  }
  warnedMessages.add(message);
  warn(message, error);
};

const createSize = (width: number, height: number): any => {
  if (!hasCv || !cv?.Size) {
    return null;
  }
  try {
    return new cv.Size(width, height);
  } catch (error) {
    warn('Size creation failed', error);
    return null;
  }
};

const safeCvtColor = (mat: any, code: number | undefined, label: string): any => {
  if (!mat || typeof mat.cvtColor !== 'function' || typeof code !== 'number') {
    return mat;
  }
  try {
    return mat.cvtColor(code);
  } catch (error) {
    warn(label, error);
    return mat;
  }
};

const safeGaussianBlur = (
  mat: any,
  width: number,
  height: number,
  sigma: number,
  label: string,
): any => {
  if (!mat || typeof mat.gaussianBlur !== 'function') {
    return mat;
  }
  const size = createSize(width, height);
  if (!size) {
    return mat;
  }
  try {
    return mat.gaussianBlur(size, sigma);
  } catch (error) {
    warnOnce(label, error);
    return mat;
  }
};

const safeMedianBlur = (mat: any, ksize: number, label: string): any => {
  if (!mat || typeof mat.medianBlur !== 'function') {
    return mat;
  }
  try {
    return mat.medianBlur(ksize);
  } catch (error) {
    warnOnce(label, error);
    return mat;
  }
};

const safeBilateralFilter = (
  mat: any,
  diameter: number,
  sigmaColor: number,
  sigmaSpace: number,
  label: string,
): any => {
  if (!mat || typeof mat.bilateralFilter !== 'function') {
    return mat;
  }
  try {
    return mat.bilateralFilter(diameter, sigmaColor, sigmaSpace);
  } catch (error) {
    warnOnce(label, error);
    return mat;
  }
};

const safeCanny = (mat: any, threshold1: number, threshold2: number, label: string): any => {
  if (!mat || typeof mat.canny !== 'function') {
    return mat;
  }
  try {
    return mat.canny(threshold1, threshold2);
  } catch (error) {
    warnOnce(label, error);
    return mat;
  }
};

const safeSplit = (mat: any, label: string): any[] => {
  if (!mat || typeof mat.split !== 'function') {
    return [mat];
  }
  try {
    return mat.split();
  } catch (error) {
    warnOnce(label, error);
    return [mat];
  }
};

const safeMerge = (channels: any[], fallback: any, label: string): any => {
  if (!hasCv || typeof cv.merge !== 'function') {
    return fallback ?? channels[0];
  }
  try {
    return cv.merge(channels);
  } catch (error) {
    warnOnce(label, error);
    return fallback ?? channels[0];
  }
};

const safeFilter2D = (mat: any, kernel: any, label: string): any => {
  if (!hasCv || !mat || !kernel) {
    return mat;
  }
  if (filter2DSupported === false) {
    return mat;
  }
  if (typeof cv.filter2D === 'function') {
    try {
      // Use CV_8U as ddepth for 8-bit unsigned integer output
      const ddepth = cv.CV_8U || -1;
      const result = cv.filter2D(mat, ddepth, kernel);
      filter2DSupported = true;
      return result;
    } catch (error) {
      warnOnce(label, error);
      filter2DSupported = false;
      return mat;
    }
  }
  if (typeof mat.filter2D === 'function') {
    try {
      // Try with ddepth parameter first (newer API)
      const ddepth = cv.CV_8U !== undefined ? cv.CV_8U : -1;
      const result = mat.filter2D(ddepth, kernel);
      filter2DSupported = true;
      return result;
    } catch (error) {
      try {
        // Fallback to single parameter (older API)
        const result = mat.filter2D(kernel);
        filter2DSupported = true;
        return result;
      } catch (fallbackError) {
        warnOnce(label, error);
        filter2DSupported = false;
        return mat;
      }
    }
  }
  return mat;
};

interface WordLike {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

interface OCRAttemptConfig {
  name: string;
  preprocess: (mat: any) => { image: any; scale?: number };
  tessParams: Record<string, string>;
  minConfidence: number;
  minWordCount?: number;
}

const cloneMat = (mat: any) => {
  if (!mat) {
    return mat;
  }
  if (typeof mat.copy === 'function') {
    return mat.copy();
  }
  if (typeof mat.clone === 'function') {
    return mat.clone();
  }
  if (hasCv && cv?.Mat) {
    try {
      return new cv.Mat(mat);
    } catch (error) {
      warnOnce('cloneMat fallback failed', error);
      return mat;
    }
  }
  return mat;
};

const scaleMat = (mat: any, scale: number) => {
  if (!hasCv || !mat) {
    return mat;
  }

  // Check minimum dimensions before scaling
  const minDimension = 3;
  if (mat.cols < minDimension || mat.rows < minDimension) {
    return null; // Signal that this mat is too small for OCR
  }

  if (scale === 1) {
    return cloneMat(mat);
  }
  if (typeof mat.resize !== 'function') {
    return cloneMat(mat);
  }
  const width = Math.max(1, Math.round(mat.cols * scale));
  const height = Math.max(1, Math.round(mat.rows * scale));

  // Ensure scaled dimensions meet minimum requirements
  if (width < minDimension || height < minDimension) {
    return null; // Scaled dimensions too small
  }

  const size = createSize(width, height);
  if (!size) {
    return cloneMat(mat);
  }
  const interpolation = typeof cv.INTER_CUBIC === 'number' ? cv.INTER_CUBIC : 0;
  try {
    return mat.resize(size, 0, 0, interpolation);
    } catch (error) {
      warnOnce('resize failed', error);
      return cloneMat(mat);
    }
};

const adaptiveThreshold = (
  mat: any,
  maxValue: number,
  adaptiveMethod: number,
  thresholdType: number,
  blockSize: number,
  C: number,
) => {
  if (!hasCv || !mat) {
    return mat;
  }
  if (typeof cv.adaptiveThreshold === 'function') {
    try {
      return cv.adaptiveThreshold(mat, maxValue, adaptiveMethod, thresholdType, blockSize, C);
    } catch (error) {
      warnOnce('global adaptiveThreshold failed', error);
    }
  }
  if (typeof mat.adaptiveThreshold === 'function') {
    try {
      return mat.adaptiveThreshold(maxValue, adaptiveMethod, thresholdType, blockSize, C);
    } catch (error) {
      warnOnce('mat adaptiveThreshold failed', error);
    }
  }
  return mat;
};

// Detect morphology capabilities and create provider
const detectMorphologyCapability = (): boolean => {
  if (!hasCv || morphologyCapabilityDetected) {
    return morphologyProvider !== null;
  }

  morphologyCapabilityDetected = true;

  const createSampleMat = () => {
    const desiredType = typeof cv.CV_8UC1 === 'number' ? cv.CV_8UC1 : (cv as any).CV_8UC1 ?? 0;
    return new cv.Mat(32, 32, desiredType, 128);
  };

  const createKernel = () => {
    try {
      const morphRect = typeof cv.MORPH_RECT === 'number' ? cv.MORPH_RECT : 0;
      if (typeof cv.getStructuringElement === 'function' && typeof cv.Size === 'function') {
        return cv.getStructuringElement(morphRect, new cv.Size(3, 3));
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const morphClose = typeof cv.MORPH_CLOSE === 'number' ? cv.MORPH_CLOSE : 3;

  const methodDefinitions: Array<{
    name: string;
    guard?: () => boolean;
    factory: () => any;
  }> = [
    {
      name: 'cv.morphologyEx(src, morphType, kernel)',
      guard: () => typeof cv.morphologyEx === 'function',
      factory: () => ({
        morphologyEx: (src: any, morphType: number, kernel: any) => cv.morphologyEx(src, morphType, kernel),
      }),
    },
    {
      name: 'cv.imgproc.morphologyEx(src, morphType, kernel)',
      guard: () => typeof (cv as any).imgproc?.morphologyEx === 'function',
      factory: () => ({
        morphologyEx: (src: any, morphType: number, kernel: any) => (cv as any).imgproc.morphologyEx(src, morphType, kernel),
      }),
    },
    {
      name: 'src.morphologyEx(morphType, kernel)',
      guard: () => {
        try {
          const testMat = createSampleMat();
          const hasMethod = typeof (testMat as any).morphologyEx === 'function';
          try { testMat?.delete?.(); } catch {}
          return hasMethod;
        } catch {
          return false;
        }
      },
      factory: () => ({
        morphologyEx: (src: any, morphType: number, kernel: any) => (src as any).morphologyEx(morphType, kernel),
      }),
    },
    {
      name: 'cv.Mat.morphologyEx(src, morphType, kernel)',
      guard: () => typeof (cv.Mat as any)?.morphologyEx === 'function',
      factory: () => ({
        morphologyEx: (src: any, morphType: number, kernel: any) => (cv.Mat as any).morphologyEx(src, morphType, kernel),
      }),
    },
  ];

  for (const method of methodDefinitions) {
    let available = true;
    if (typeof method.guard === 'function') {
      try {
        available = Boolean(method.guard());
      } catch (error) {
        available = false;
      }
    }

    if (!available) continue;

    let sampleInput: any = null;
    let sampleOutput: any = null;
    let kernel: any = null;

    try {
      const instance = method.factory();
      if (!instance || typeof instance.morphologyEx !== 'function') {
        continue;
      }

      sampleInput = createSampleMat();
      kernel = createKernel();
      if (!kernel) {
        continue;
      }

      sampleOutput = instance.morphologyEx(sampleInput, morphClose, kernel);
      if (!sampleOutput) {
        continue;
      }

      // Success! Create the provider
      morphologyProvider = () => ({
        instance,
        method: 'morphologyEx',
        source: method.name,
        operation: 'morphologyEx'
      });

      try { sampleOutput?.delete?.(); } catch {}
      try { sampleInput?.delete?.(); } catch {}
      try { kernel?.delete?.(); } catch {}

      return true;
    } catch (error) {
      // Continue to next method
    } finally {
      try { sampleOutput?.delete?.(); } catch {}
      try { sampleInput?.delete?.(); } catch {}
      try { kernel?.delete?.(); } catch {}
    }
  }

  return false;
};

const morph = (mat: any, op: number, kernel: any) => {
  if (!hasCv || !mat || !kernel) {
    return mat;
  }

  // Ensure morphology capability is detected
  if (!detectMorphologyCapability()) {
    return mat;
  }

  if (!morphologyProvider) {
    return mat;
  }

  try {
    const { instance, method, source } = morphologyProvider();
    if (!instance || typeof instance[method] !== 'function') {
      warnOnce(`Morphology provider ${source} returned invalid instance`);
      return mat;
    }
    return instance[method](mat, op, kernel);
  } catch (error) {
    warnOnce('Morphology operation failed', error);
    return mat;
  }
};

const bitwiseOr = (a: any, b: any) => {
  if (!hasCv) {
    return a ?? b;
  }
  if (typeof cv.bitwiseOr === 'function') {
    try {
      return cv.bitwiseOr(a, b);
    } catch (error) {
      warnOnce('global bitwiseOr failed', error);
    }
  }
  if (a?.bitwiseOr) {
    try {
      return a.bitwiseOr(b);
    } catch (error) {
      warnOnce('mat bitwiseOr failed', error);
    }
  }
  return a;
};

let cachedSharpenKernel: any | null = null;

const getSharpenKernel = () => {
  if (!hasCv || !cv?.Mat) {
    return null;
  }
  if (cachedSharpenKernel) {
    return cachedSharpenKernel;
  }
  try {
    cachedSharpenKernel = new cv.Mat(
      [
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0],
      ],
      typeof cv.CV_32F === 'number' ? cv.CV_32F : 5,
    );
  } catch (error) {
    warnOnce('Sharpen kernel creation failed', error);
    cachedSharpenKernel = null;
  }
  return cachedSharpenKernel;
};

const sharpen = (mat: any) => {
  if (!hasCv || !mat) {
    return mat;
  }
  const kernel = getSharpenKernel();
  if (!kernel) {
    return mat;
  }
  return safeFilter2D(mat, kernel, 'filter2D sharpen failed');
};

const enhanceUiColors = (mat: any) => {
  if (!hasCv || !mat) {
    return mat;
  }
  const blurred = safeGaussianBlur(mat, 3, 3, 0, 'enhanceUiColors gaussianBlur failed');
  const sharpenedMat = sharpen(blurred);
  if (typeof cv.addWeighted === 'function') {
    try {
      return cv.addWeighted(sharpenedMat, 1.2, mat, -0.2, 0);
    } catch (error) {
      warnOnce('addWeighted failed', error);
    }
  }
  if (sharpenedMat?.addWeighted) {
    try {
      return sharpenedMat.addWeighted(1.2, mat, -0.2, 0);
    } catch (error) {
      warnOnce('mat addWeighted failed', error);
    }
  }
  return sharpenedMat;
};

const createClahe = (clipLimit: number, tileWidth: number, tileHeight: number) => {
  if (!hasCv) {
    return null;
  }
  const tileSize = createSize(tileWidth, tileHeight);
  if (!tileSize) {
    return null;
  }
  if (typeof cv.createCLAHE === 'function') {
    try {
      return cv.createCLAHE(clipLimit, tileSize);
    } catch (error) {
      warnOnce('createCLAHE failed', error);
    }
  }
  if (cv?.CLAHE) {
    try {
      return new cv.CLAHE(clipLimit, tileSize);
    } catch (error) {
      warnOnce('CLAHE constructor failed', error);
    }
  }
  return null;
};

const applyClahe = (clahe: any, mat: any) => {
  if (!clahe || !mat) {
    return mat;
  }
  if (typeof clahe.apply === 'function') {
    try {
      return clahe.apply(mat);
    } catch (error) {
      warnOnce('CLAHE apply failed', error);
    }
  }
  return mat;
};

const createMorphRectKernel = (width: number, height: number) => {
  if (!hasCv) {
    return null;
  }
  if (typeof cv.getStructuringElement === 'function' && cv?.Size) {
    try {
      const size = createSize(width, height);
      if (size) {
        return cv.getStructuringElement(cv.MORPH_RECT ?? 0, size);
      }
    } catch (error) {
      warnOnce('getStructuringElement failed', error);
    }
  }
  if (cv?.Mat?.ones) {
    try {
      const mat = cv.Mat.ones(height, width, typeof cv.CV_8U === 'number' ? cv.CV_8U : 0);
      return mat;
    } catch (error) {
      warnOnce('Mat.ones fallback failed', error);
    }
  }
  return null;
};

const DEFAULT_CHAR_WHITELIST =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/\\"\'`~!@#$%^&*()_+={}[]|:;,.?<>';

const attemptDefinitions = (whitelist: string): OCRAttemptConfig[] => {
  if (!hasCv) {
    return [];
  }

  const MORPH_RECT = cv.MORPH_RECT ?? 0;
  const MORPH_CLOSE = cv.MORPH_CLOSE ?? 3;
  const MORPH_OPEN = cv.MORPH_OPEN ?? 2;
  const MORPH_GRADIENT = cv.MORPH_GRADIENT ?? 4;
  const ADAPTIVE_GAUSSIAN = cv.ADAPTIVE_THRESH_GAUSSIAN_C ?? 1;
  const ADAPTIVE_MEAN = cv.ADAPTIVE_THRESH_MEAN_C ?? 0;
  const THRESH_BINARY = cv.THRESH_BINARY ?? 0;
  const THRESH_BINARY_INV = cv.THRESH_BINARY_INV ?? 1;
  const COLOR_BGR2GRAY = cv.COLOR_BGR2GRAY;
  const COLOR_BGR2LAB = cv.COLOR_BGR2LAB;
  const COLOR_LAB2BGR = cv.COLOR_Lab2BGR ?? cv.COLOR_LAB2BGR;

  return [
    {
      name: 'clahe_psm8_scale_1.5',
      preprocess: (input) => {
        const scaled = scaleMat(input, 1.5);
        if (!scaled) return { image: null };
        const gray = safeCvtColor(
          scaled,
          COLOR_BGR2GRAY,
          'clahe_psm8_scale_1.5 cvtColor BGR2GRAY failed',
        );
        const clahe = createClahe(2, 8, 8);
        const equalized = applyClahe(clahe, gray);
        const sharpenedMat = sharpen(equalized);
        return { image: sharpenedMat, scale: 1.5 };
      },
      tessParams: {
        tessedit_pageseg_mode: '8',
        tessedit_char_whitelist: whitelist,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      },
      minConfidence: 65,
      minWordCount: 2,
    },
    {
      name: 'denoise_psm6_scale_1.2',
      preprocess: (input) => {
        const scaled = scaleMat(input, 1.2);
        if (!scaled) return { image: null };
        const gray = safeCvtColor(
          scaled,
          COLOR_BGR2GRAY,
          'denoise_psm6_scale_1.2 cvtColor BGR2GRAY failed',
        );
        const denoised = safeGaussianBlur(
          gray,
          3,
          3,
          1.1,
          'denoise_psm6_scale_1.2 gaussianBlur failed',
        );
        const thresh = adaptiveThreshold(
          denoised,
          255,
          ADAPTIVE_GAUSSIAN,
          THRESH_BINARY,
          15,
          2,
        );
        return { image: thresh, scale: 1.2 };
      },
      tessParams: {
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: whitelist,
        user_defined_dpi: '280',
      },
      minConfidence: 60,
      minWordCount: 2,
    },
    {
      name: 'edge_psm7_scale_1.8',
      preprocess: (input) => {
        const scaled = scaleMat(input, 1.8);
        if (!scaled) return { image: null };
        const gray = safeCvtColor(
          scaled,
          COLOR_BGR2GRAY,
          'edge_psm7_scale_1.8 cvtColor BGR2GRAY failed',
        );
        const bilateral = safeBilateralFilter(
          gray,
          7,
          75,
          75,
          'edge_psm7_scale_1.8 bilateralFilter failed',
        );
        const edges = safeCanny(bilateral, 60, 120, 'edge_psm7_scale_1.8 canny failed');
        const morphKernel = createMorphRectKernel(2, 2);
        const enhanced = morph(edges, MORPH_CLOSE, morphKernel);
        return { image: enhanced, scale: 1.8 };
      },
      tessParams: {
        tessedit_pageseg_mode: '7',
        tessedit_char_whitelist: whitelist,
        tessedit_char_blacklist: '@{}',
        user_defined_dpi: '320',
      },
      minConfidence: 55,
    },
    {
      name: 'ui_color_psm13',
      preprocess: (input) => {
        const enhanced = enhanceUiColors(input);
        const scale = 1.4;
        const resized = scaleMat(enhanced, scale);
        if (!resized) return { image: null };
        const lab = safeCvtColor(
          resized,
          COLOR_BGR2LAB,
          'ui_color_psm13 cvtColor BGR2LAB failed',
        );
        const channels = safeSplit(lab, 'ui_color_psm13 split failed');
        const clahe = createClahe(2, 8, 8);
        if (clahe && channels[0]) {
          channels[0] = applyClahe(clahe, channels[0]);
        }
        const merged = safeMerge(channels, resized, 'ui_color_psm13 merge failed');
        const backToBgr = safeCvtColor(
          merged,
          COLOR_LAB2BGR,
          'ui_color_psm13 cvtColor Lab2BGR failed',
        );
        const gray = safeCvtColor(
          backToBgr,
          COLOR_BGR2GRAY,
          'ui_color_psm13 cvtColor BGR2GRAY failed',
        );
        return { image: gray, scale };
      },
      tessParams: {
        tessedit_pageseg_mode: '13',
        tessedit_char_whitelist: whitelist,
        preserve_interword_spaces: '1',
        user_defined_dpi: '260',
      },
      minConfidence: 50,
    },
    {
      name: 'ui_buttons_psm8',
      preprocess: (input) => {
        const scaled = scaleMat(input, 1.3);
        if (!scaled) return { image: null };
        const gray = safeCvtColor(
          scaled,
          COLOR_BGR2GRAY,
          'ui_buttons_psm8 cvtColor BGR2GRAY failed',
        );
        const median = safeMedianBlur(gray, 3, 'ui_buttons_psm8 medianBlur failed');
        const thresh = adaptiveThreshold(
          median,
          255,
          ADAPTIVE_MEAN,
          THRESH_BINARY_INV,
          21,
          4,
        );
        const kernel = createMorphRectKernel(3, 3);
        const closed = morph(thresh, MORPH_CLOSE, kernel);
        const combined = bitwiseOr(cloneMat(closed), median);
        return { image: combined, scale: 1.3 };
      },
      tessParams: {
        tessedit_pageseg_mode: '8',
        tessedit_char_whitelist: whitelist,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      },
      minConfidence: 55,
      minWordCount: 1,
    },
    {
      name: 'morphology_gradient_psm6',
      preprocess: (input) => {
        const scaled = scaleMat(input, 1.4);
        if (!scaled) return { image: null };
        const gray = safeCvtColor(
          scaled,
          COLOR_BGR2GRAY,
          'morphology_gradient_psm6 cvtColor BGR2GRAY failed',
        );
        // Apply morphological gradient to enhance text edges
        const kernel = createMorphRectKernel(2, 2);
        const gradient = morph(gray, MORPH_GRADIENT, kernel);
        const thresh = adaptiveThreshold(
          gradient,
          255,
          ADAPTIVE_GAUSSIAN,
          THRESH_BINARY,
          11,
          2,
        );
        return { image: thresh, scale: 1.4 };
      },
      tessParams: {
        tessedit_pageseg_mode: '6',
        tessedit_char_whitelist: whitelist,
        preserve_interword_spaces: '1',
        user_defined_dpi: '300',
      },
      minConfidence: 60,
      minWordCount: 1,
    },
    {
      name: 'ui_buttons_enhanced_psm8',
      preprocess: (input) => {
        const scaled = scaleMat(input, 1.6);
        if (!scaled) return { image: null };
        const gray = safeCvtColor(
          scaled,
          COLOR_BGR2GRAY,
          'ui_buttons_enhanced_psm8 cvtColor BGR2GRAY failed',
        );
        // Apply opening to remove noise, then closing to fill gaps
        const smallKernel = createMorphRectKernel(2, 2);
        const opened = morph(gray, MORPH_OPEN, smallKernel);
        const kernel = createMorphRectKernel(4, 2);
        const closed = morph(opened, MORPH_CLOSE, kernel);
        // Apply CLAHE for contrast enhancement
        const clahe = createClahe(3, 8, 8);
        const enhanced = applyClahe(clahe, closed);
        return { image: enhanced, scale: 1.6 };
      },
      tessParams: {
        tessedit_pageseg_mode: '8',
        tessedit_char_whitelist: whitelist,
        preserve_interword_spaces: '1',
        user_defined_dpi: '320',
      },
      minConfidence: 65,
      minWordCount: 1,
    },
  ];
};

export class OCRDetector {
  private worker: Worker | null = null;
  private readonly cvAvailable = hasCv;
  private readonly debugEnabled =
    typeof process !== 'undefined' && process?.env?.BYTEBOT_OCR_DEBUG === 'true';

  async detect(screenshotBuffer: Buffer, region?: BoundingBox): Promise<DetectedElement[]> {
    if (!this.cvAvailable) {
      return this.basicDetect(screenshotBuffer, region);
    }

    return this.advancedDetect(screenshotBuffer, region);
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  private async getWorker(): Promise<Worker> {
    if (!this.worker) {
      this.worker = await createWorker();

      const originalWarn = console.warn;
      console.warn = (message?: unknown, ...rest: unknown[]) => {
        if (
          typeof message === 'string' &&
          (message.includes('`loadLanguage` is depreciated') ||
            message.includes('`initialize` is depreciated'))
        ) {
          return;
        }
        originalWarn.call(console, message as any, ...rest);
      };

      try {
        const workerAny = this.worker as unknown as {
          loadLanguage?: (lang: string) => Promise<void>;
          initialize?: (lang: string) => Promise<void>;
        };

        if (typeof workerAny.loadLanguage === 'function') {
          await workerAny.loadLanguage('eng');
        }

        if (typeof workerAny.initialize === 'function') {
          await workerAny.initialize('eng');
        }
      } finally {
        console.warn = originalWarn;
      }
    }

    return this.worker;
  }

  private toRecognizeOptions(region: BoundingBox): RecognizeRectangleOption {
    return {
      rectangle: {
        left: Math.max(0, Math.floor(region.x)),
        top: Math.max(0, Math.floor(region.y)),
        width: Math.max(1, Math.floor(region.width)),
        height: Math.max(1, Math.floor(region.height)),
      },
    };
  }

  private cleanRecognizedText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
  }

  private async basicDetect(screenshotBuffer: Buffer, region?: BoundingBox): Promise<DetectedElement[]> {
    const worker = await this.getWorker();
    const options = region ? this.toRecognizeOptions(region) : undefined;
    const { data } = await worker.recognize(screenshotBuffer, options as any);

    if (!data?.words?.length) {
      return [];
    }

    const elements: DetectedElement[] = [];
    const offsetX = region ? Math.max(0, Math.floor(region.x)) : 0;
    const offsetY = region ? Math.max(0, Math.floor(region.y)) : 0;

    for (const word of data.words) {
      const confidence = word.confidence ?? 0;
      if (confidence <= 70) {
        continue;
      }

      const text = this.cleanRecognizedText(word.text || '');
      if (!text) {
        continue;
      }

      const x0 = word.bbox.x0 + offsetX;
      const y0 = word.bbox.y0 + offsetY;
      const x1 = word.bbox.x1 + offsetX;
      const y1 = word.bbox.y1 + offsetY;
      const width = Math.max(1, x1 - x0);
      const height = Math.max(1, y1 - y0);

      elements.push({
        id: this.generateElementId('ocr'),
        type: this.inferElementType(text, width, height),
        coordinates: {
          x: x0,
          y: y0,
          width,
          height,
          centerX: x0 + width / 2,
          centerY: y0 + height / 2,
        },
        confidence: Math.min(Math.max(confidence / 100, 0), 1),
        text,
        description: `Text element: "${text}"`,
        metadata: {
          detectionMethod: 'ocr',
          ocrConfidence: confidence,
          ocrAttempt: 'basic_fallback',
        },
      });
    }

    return elements;
  }

  private advancedDecode(buffer: Buffer): any {
    if (!this.cvAvailable || !buffer) {
      return null;
    }
    try {
      return decodeImageBuffer(cv as typeof import('@u4/opencv4nodejs'), buffer, {
        source: 'OCRDetector.advancedDecode',
        warnOnce,
      });
    } catch (error) {
      warnOnce('advanced decode failed; falling back to basic OCR path', error);
      return null;
    }
  }

  private cropToRegion(mat: any, region?: BoundingBox): { image: any; offsetX: number; offsetY: number } {
    if (!region) {
      return { image: mat, offsetX: 0, offsetY: 0 };
    }

    const x = Math.max(0, Math.floor(region.x));
    const y = Math.max(0, Math.floor(region.y));
    const width = Math.min(mat.cols - x, Math.max(1, Math.floor(region.width)));
    const height = Math.min(mat.rows - y, Math.max(1, Math.floor(region.height)));

    const rect = new cv.Rect(x, y, width, height);
    const roi = mat.getRegion(rect);
    return { image: roi, offsetX: x, offsetY: y };
  }

  private buildAttempts(): OCRAttemptConfig[] {
    return attemptDefinitions(DEFAULT_CHAR_WHITELIST);
  }

  private scoreAttempt(words: WordLike[]): number {
    if (words.length === 0) {
      return 0;
    }
    const avgConfidence = words.reduce((sum, word) => sum + (word.confidence ?? 0), 0) / words.length;
    const uniqueTexts = new Set(words.map((word) => this.cleanRecognizedText(word.text || '').toLowerCase())).size;
    return avgConfidence * 0.7 + uniqueTexts * 5;
  }

  private wordsToElements(
    words: WordLike[],
    offsetX: number,
    offsetY: number,
    scale: number,
    attemptName: string,
  ): DetectedElement[] {
    const elements: DetectedElement[] = [];

    for (const word of words) {
      const confidence = word.confidence ?? 0;
      if (confidence <= 0) {
        continue;
      }

      const rawText = this.cleanRecognizedText(word.text || '');
      if (!rawText) {
        continue;
      }

      const x0 = word.bbox.x0 / scale + offsetX;
      const y0 = word.bbox.y0 / scale + offsetY;
      const x1 = word.bbox.x1 / scale + offsetX;
      const y1 = word.bbox.y1 / scale + offsetY;
      const width = Math.max(1, x1 - x0);
      const height = Math.max(1, y1 - y0);

      elements.push({
        id: this.generateElementId('ocr'),
        type: this.inferElementType(rawText, width, height),
        coordinates: {
          x: Math.round(x0),
          y: Math.round(y0),
          width: Math.round(width),
          height: Math.round(height),
          centerX: Math.round(x0 + width / 2),
          centerY: Math.round(y0 + height / 2),
        },
        confidence: Math.max(0, Math.min(confidence / 100, 1)),
        text: rawText,
        description: `Text element: "${rawText}"`,
        metadata: {
          detectionMethod: 'ocr',
          ocrConfidence: confidence,
          ocrAttempt: attemptName,
        },
      });
    }

    return elements;
  }

  private deduplicateWords(words: WordLike[]): WordLike[] {
    const seen = new Map<string, WordLike>();

    for (const word of words) {
      const key = `${Math.round(word.bbox.x0 / 5)}-${Math.round(word.bbox.y0 / 5)}-${this.cleanRecognizedText(word.text || '').toLowerCase()}`;
      const existing = seen.get(key);
      if (!existing || (word.confidence ?? 0) > (existing.confidence ?? 0)) {
        seen.set(key, word);
      }
    }

    return [...seen.values()];
  }

  private async advancedDetect(
    screenshotBuffer: Buffer,
    region?: BoundingBox,
  ): Promise<DetectedElement[]> {
    if (!this.cvAvailable) {
      return this.basicDetect(screenshotBuffer, region);
    }

    const worker = await this.getWorker();
    const baseImage = this.advancedDecode(screenshotBuffer);
    if (!baseImage) {
      return this.basicDetect(screenshotBuffer, region);
    }

    const { image: cropped, offsetX, offsetY } = this.cropToRegion(baseImage, region);

    // Check minimum dimensions for OCR
    const minDimension = 3;
    if (!cropped || cropped.cols < minDimension || cropped.rows < minDimension) {
      if (this.debugEnabled) {
        this.debug(
          `Region too small for OCR: ${cropped?.cols ?? 0}x${cropped?.rows ?? 0} (min: ${minDimension}x${minDimension})`,
        );
      }
      return [];
    }

    const attempts = this.buildAttempts();
    const attemptResults: {
      config: OCRAttemptConfig;
      words: WordLike[];
      score: number;
      scale: number;
      durationMs: number;
    }[] = [];

    for (const attempt of attempts) {
      try {
        const startedAt = Date.now();
        const { image: processed, scale = 1 } = attempt.preprocess(cloneMat(cropped));

        // Skip if preprocessing returned null (image too small)
        if (!processed) {
          if (this.debugEnabled) {
            this.debug(`Attempt ${attempt.name} skipped: preprocessed image too small`);
          }
          continue;
        }

        const encoded = cv.imencode('.png', processed);

        const workerAny = worker as unknown as {
          setParameters?: (params: Record<string, string>) => Promise<void>;
        };
        if (typeof workerAny.setParameters === 'function') {
          await workerAny.setParameters(attempt.tessParams);
        }
        const { data } = await worker.recognize(encoded);

        const words: WordLike[] = (data?.words ?? [])
          .filter((word) => (word.confidence ?? 0) >= attempt.minConfidence)
          .map((word) => ({
            text: word.text || '',
            confidence: word.confidence ?? 0,
            bbox: {
              x0: word.bbox.x0,
              y0: word.bbox.y0,
              x1: word.bbox.x1,
              y1: word.bbox.y1,
            },
          }));

        const score = this.scoreAttempt(words);
        const durationMs = Date.now() - startedAt;

        if (words.length > 0 || (attempt.minWordCount && words.length >= attempt.minWordCount)) {
          attemptResults.push({ config: attempt, words, score, scale, durationMs });
        } else if (this.debugEnabled) {
          this.debug(
            `Attempt ${attempt.name} produced no usable words (score=${score.toFixed(2)}, duration=${durationMs}ms)`,
          );
        }
      } catch (error) {
        warn(`OCR attempt ${attempt.name} failed`, error);
        if (error instanceof Error && this.debugEnabled && error.stack) {
          this.debug(`Stack trace for ${attempt.name}: ${error.stack}`);
        }
      }
    }

    if (attemptResults.length === 0) {
      if (this.debugEnabled) {
        this.debug('All advanced OCR attempts failed; falling back to basic pipeline.');
      }
      return this.basicDetect(screenshotBuffer, region);
    }

    attemptResults.sort((a, b) => b.score - a.score);
    const best = attemptResults[0];

    if (this.debugEnabled) {
      const { config, score, durationMs, words } = best;
      this.debug(
        `Selected OCR attempt ${config.name} score=${score.toFixed(2)} duration=${durationMs}ms words=${words.length}`,
      );
    }

    const deduped = this.deduplicateWords(best.words);
    return this.wordsToElements(deduped, offsetX, offsetY, best.scale ?? 1, best.config.name);
  }

  private inferElementType(text: string, width: number, height: number): ElementType {
    const lowerText = text.toLowerCase();
    const buttonKeywords = [
      'install',
      'save',
      'cancel',
      'ok',
      'submit',
      'login',
      'sign in',
      'download',
    ];

    if (buttonKeywords.some((keyword) => lowerText.includes(keyword))) {
      return 'button';
    }

    if (lowerText.includes('http') || lowerText.includes('www') || lowerText.includes('.com')) {
      return 'link';
    }

    if (height < 40 && width > 100 && lowerText.length < 50) {
      return 'input';
    }

    return 'text';
  }

  private generateElementId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  private debug(message: string): void {
    if (!this.debugEnabled) {
      return;
    }
    // eslint-disable-next-line no-console
    console.log(`[OCRDetector] ${message}`);
  }
}
