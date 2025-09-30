import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { performance } from 'node:perf_hooks';
import { createCanvas, loadImage } from 'canvas';
import { createWorker, Worker } from 'tesseract.js';
import {
  BoundingBox,
  ClickTarget,
  DetectedElement,
  DetectionConfig,
  ElementType,
} from '../types';
import {
  DetectionResult as UniversalDetectionResult,
  UniversalDetectionMethod,
  UniversalElementType,
  UniversalUIElement,
} from '../interfaces/universal-element.interface';
import { UniversalDetectorService } from './universal-detector.service';
import { decodeImageBuffer } from '../utils/cv-decode';
import { getOpenCvModule, hasOpenCv, logOpenCvWarning } from '../utils/opencv-loader';

type TemplateDetectorModule = typeof import('../detectors/template/template-detector');
type EdgeDetectorModule = typeof import('../detectors/edge/edge-detector');

type MatLike = {
  cols: number;
  rows: number;
  clone?: () => MatLike;
  copy?: () => MatLike;
  resize?: (size: any, fx?: number, fy?: number, interpolation?: number) => MatLike;
  cvtColor?: (code: number) => MatLike;
  gaussianBlur?: (size: any, sigma: number) => MatLike;
  medianBlur?: (ksize: number) => MatLike;
  bilateralFilter?: (diameter: number, sigmaColor: number, sigmaSpace: number) => MatLike;
  canny?: (threshold1: number, threshold2: number) => MatLike;
  getRegion?: (rect: any) => MatLike;
  release?: () => void;
  channels?: number | (() => number);
};

type MatConversion = {
  mat: MatLike;
  needsRelease: boolean;
};

type CanvasImageData = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

type OcrStrategy = {
  name: string;
  preprocessMethod: string;
  tessParams: Record<string, string>;
  minConfidence: number;
};

type ClaheProviderResult = {
  instance: any;
  method: string;
  source: string;
};

type MorphologyProviderResult = {
  instance: any;
  method: string;
  source: string;
  operation: string;
};

const cv: any = getOpenCvModule();
const hasCv = hasOpenCv();

logOpenCvWarning('ElementDetectorService');
const warnedMessages = new Set<string>();

const formatErrorDetail = (error: unknown): string => {
  if (!error) {
    return '';
  }
  if (typeof error === 'string') {
    const [firstLine] = error.split('\n');
    return firstLine?.trim() ?? '';
  }
  const message = (error as Error)?.message ?? String(error);
  const [firstLine] = message.split('\n');
  return firstLine?.trim() ?? '';
};

const warnOnce = (message: string, error?: unknown) => {
  if (warnedMessages.has(message)) {
    return;
  }
  warnedMessages.add(message);
  const baseMessage = `[ElementDetectorService] ${message}`;
  if (!error) {
    return;
  }
  const detail = formatErrorDetail(error);
  if (detail) {
    return;
  }
};

const MIN_WIDTH = 10;
const MIN_HEIGHT = 10;
const DEFAULT_SCREEN_WIDTH = 1920;
const DEFAULT_SCREEN_HEIGHT = 1080;
const MIN_INTERACTIVE_WIDTH = 18;
const MIN_INTERACTIVE_HEIGHT = 14;
const DEFAULT_CHAR_WHITELIST =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/\\"\'`~!@#$%^&*()_+={}[]|:;,.?<>';

type OpenCvCapabilities = {
  clahe: boolean;
  claheCtor: boolean;
  matClahe: boolean;
  equalizeHistAdaptive: boolean;
  fastNlMeans: boolean;
  filter2D: boolean;
  morphologyEx: boolean;
  morphologyExMat: boolean;
  morphologyExImgproc: boolean;
  getStructuringElement: boolean;
  claheMethod?: string;
  morphologyMethod?: string;
  claheDiagnostics?: Record<string, string>;
  morphologyDiagnostics?: Record<string, string>;
};

@Injectable()
export class ElementDetectorService {
  private readonly logger = new Logger(ElementDetectorService.name);
  private readonly ocrConfidenceEarlyExit = 0.7;
  private worker: Worker | null = null;
  private workerPromise: Promise<Worker> | null = null;
  private templateDetector: InstanceType<TemplateDetectorModule['TemplateDetector']> | null = null;
  private edgeDetector: InstanceType<EdgeDetectorModule['EdgeDetector']> | null = null;
  private templateDetectorLoaded = false;
  private edgeDetectorLoaded = false;
  private opencvCapabilities: OpenCvCapabilities = {
    clahe: false,
    claheCtor: false,
    matClahe: false,
    equalizeHistAdaptive: false,
    fastNlMeans: false,
    filter2D: false,
    morphologyEx: false,
    morphologyExMat: false,
    morphologyExImgproc: false,
    getStructuringElement: false,
    claheDiagnostics: {},
    morphologyDiagnostics: {},
  };
  private claheProvider: (() => ClaheProviderResult) | null = null;
  private claheFactoryName: string | null = null;
  private claheApplyMethod: string | null = null;
  private morphologyProvider: (() => MorphologyProviderResult) | null = null;
  private morphologyFactoryName: string | null = null;
  private morphologyApplyMethod: string | null = null;

  constructor(
    @Optional()
    @Inject(forwardRef(() => UniversalDetectorService))
    private readonly universalDetector?: UniversalDetectorService,
  ) {
    this.detectOpenCVCapabilities();
  }

  private detectOpenCVCapabilities(): void {
    if (!hasCv) {
      this.logger.warn('OpenCV not available; vision features will degrade');
      return;
    }

    this.opencvCapabilities = {
      clahe: typeof cv.createCLAHE === 'function',
      claheCtor: typeof (cv as any).CLAHE === 'function',
      matClahe: typeof (cv.Mat?.prototype as any)?.clahe === 'function',
      equalizeHistAdaptive:
        typeof (cv.Mat?.prototype as any)?.equalizeHistAdaptive === 'function',
      fastNlMeans:
        typeof (cv.Mat?.prototype as any)?.fastNlMeansDenoising === 'function' ||
        typeof cv.fastNlMeansDenoising === 'function',
      filter2D:
        typeof cv.filter2D === 'function' ||
        typeof (cv.Mat?.prototype as any)?.filter2D === 'function',
      morphologyEx: typeof cv.morphologyEx === 'function',
      morphologyExMat: typeof (cv.Mat?.prototype as any)?.morphologyEx === 'function',
      morphologyExImgproc: typeof (cv as any).imgproc?.morphologyEx === 'function',
      getStructuringElement: typeof cv.getStructuringElement === 'function',
      claheDiagnostics: {},
      morphologyDiagnostics: {},
    };

    const diagnostics = this.opencvCapabilities.claheDiagnostics ?? {};
    const versionInfo = (() => {
      try {
        const ver = (cv as any).version;
        
        // Handle string version
        if (typeof ver === 'string') {
          return ver;
        }
        
        // Handle object version {major, minor, patch}
        if (typeof ver === 'object' && ver !== null) {
          const { major, minor, patch } = ver;
          if (major !== undefined) {
            return `${major}.${minor || 0}.${patch || 0}`;
          }
        }
        
        // Try VERSION constant
        if (typeof (cv as any).VERSION === 'string') {
          return (cv as any).VERSION;
        }
        
        return 'unknown';
      } catch (error) {
        diagnostics.versionError = (error as Error)?.message ?? String(error);
        return 'unknown';
      }
    })();

    try {
      if (typeof cv.getBuildInformation === 'function') {
        const buildInfo = cv.getBuildInformation();
        const buildSummary = typeof buildInfo === 'string'
          ? buildInfo.split('\n').slice(0, 3).join(' | ')
          : 'unavailable';
        this.logger.debug(`[ElementDetectorService] OpenCV build info: ${buildSummary}`);
      }
    } catch (error) {
      diagnostics.buildInfoError = (error as Error)?.message ?? String(error);
    }

    try {
      const moduleKeys = Object.keys(cv).filter((key) => {
        try {
          const value = (cv as any)[key];
          return typeof value === 'object' && value !== null;
        } catch {
          return false;
        }
      });

      const preview = moduleKeys.slice(0, 15);
      if (moduleKeys.length > 0) {
        this.logger.debug(
          `[ElementDetectorService] OpenCV modules (${moduleKeys.length}): ${preview.join(', ')}${moduleKeys.length > preview.length ? ', …' : ''}`,
        );
      }
    } catch (error) {
      diagnostics.modulesError = (error as Error)?.message ?? String(error);
    }

    const claheCapability = this.detectClaheCapability();
    if (claheCapability.success) {
      this.claheProvider = claheCapability.provider;
      this.claheFactoryName = claheCapability.methodName ?? null;
      this.claheApplyMethod = claheCapability.applyMethod ?? null;
      this.opencvCapabilities.clahe = true;
      this.opencvCapabilities.claheMethod = claheCapability.methodName;
      if (claheCapability.methodIndex === null && (claheCapability.errors?.length ?? 0) > 0) {
        diagnostics.claheFallback = JSON.stringify(claheCapability.errors);
      }
      const methodDescriptor = `${claheCapability.methodName ?? 'unnamed'} -> ${claheCapability.applyMethod ?? 'apply'}`;
      if (claheCapability.methodIndex === null) {
        this.logger.log(
          `[ElementDetectorService] CLAHE fallback enabled (${methodDescriptor}) on OpenCV ${versionInfo}`,
        );
      } else {
        this.logger.log(
          `[ElementDetectorService] CLAHE available via method index ${claheCapability.methodIndex} (${methodDescriptor}) on OpenCV ${versionInfo}`,
        );
      }
    } else {
      this.claheProvider = null;
      this.claheFactoryName = null;
      this.claheApplyMethod = null;
      this.opencvCapabilities.clahe = false;
      this.opencvCapabilities.claheMethod = undefined;
      diagnostics.claheError = JSON.stringify(claheCapability.errors ?? []);
      this.logger.warn(
        `[ElementDetectorService] CLAHE unavailable after ${claheCapability.attempts} attempts - OCR quality may be reduced`,
      );
    }

    // Detect morphology capabilities
    const morphologyDiagnostics = this.opencvCapabilities.morphologyDiagnostics ?? {};
    const morphologyCapability = this.detectMorphologyCapability();
    if (morphologyCapability.success) {
      this.morphologyProvider = morphologyCapability.provider;
      this.morphologyFactoryName = morphologyCapability.methodName ?? null;
      this.morphologyApplyMethod = morphologyCapability.applyMethod ?? null;
      this.opencvCapabilities.morphologyEx = true;
      this.opencvCapabilities.morphologyMethod = morphologyCapability.methodName;
      if (morphologyCapability.methodIndex === null && (morphologyCapability.errors?.length ?? 0) > 0) {
        morphologyDiagnostics.morphologyFallback = JSON.stringify(morphologyCapability.errors);
      }
      const morphMethodDescriptor = `${morphologyCapability.methodName ?? 'unnamed'} -> ${morphologyCapability.applyMethod ?? 'morphologyEx'}`;
      if (morphologyCapability.methodIndex === null) {
        this.logger.log(
          `[ElementDetectorService] Morphology fallback enabled (${morphMethodDescriptor}) on OpenCV ${versionInfo}`,
        );
      } else {
        this.logger.log(
          `[ElementDetectorService] Morphology available via method index ${morphologyCapability.methodIndex} (${morphMethodDescriptor}) on OpenCV ${versionInfo}`,
        );
      }
    } else {
      this.morphologyProvider = null;
      this.morphologyFactoryName = null;
      this.morphologyApplyMethod = null;
      this.opencvCapabilities.morphologyEx = false;
      this.opencvCapabilities.morphologyMethod = undefined;
      morphologyDiagnostics.morphologyError = JSON.stringify(morphologyCapability.errors ?? []);
      this.logger.warn(
        `[ElementDetectorService] Morphology unavailable after ${morphologyCapability.attempts} attempts - edge detection quality may be reduced`,
      );
    }

    if (Object.keys(diagnostics).length > 0 || Object.keys(morphologyDiagnostics).length > 0) {
      this.logger.debug(
        `[ElementDetectorService] OpenCV diagnostics: ${JSON.stringify({...diagnostics, ...morphologyDiagnostics})}`,
      );
    }

    this.opencvCapabilities.claheDiagnostics = diagnostics;
    this.opencvCapabilities.morphologyDiagnostics = morphologyDiagnostics;
  }

  private detectClaheCapability(): {
    success: boolean;
    provider: (() => ClaheProviderResult) | null;
    methodIndex: number | null;
    methodName?: string;
    applyMethod?: string;
    errors: Array<Record<string, string>>;
    attempts: number;
  } {
    if (!hasCv) {
      return {
        success: false,
        provider: null,
        methodIndex: null,
        methodName: undefined,
        applyMethod: undefined,
        errors: [{ reason: 'OpenCV unavailable' }],
        attempts: 0,
      };
    }

    const errors: Array<Record<string, string>> = [];
    const clipLimit = 4.0;
    const createTile = () => new cv.Size(8, 8);
    const desiredType =
      typeof cv.CV_8UC1 === 'number' ? cv.CV_8UC1 : (cv as any).CV_8UC1 ?? 0;

    const methodDefinitions: Array<{
      name: string;
      guard?: () => boolean;
      factory: () => any;
    }> = [
      {
        name: 'cv.imgproc.createCLAHE(clip, Size)',
        guard: () => typeof (cv as any).imgproc?.createCLAHE === 'function',
        factory: () => (cv as any).imgproc.createCLAHE(clipLimit, createTile()),
      },
      {
        name: 'cv.imgproc.createCLAHE(options)',
        guard: () => typeof (cv as any).imgproc?.createCLAHE === 'function',
        factory: () => (cv as any).imgproc.createCLAHE({ clipLimit, tileGridSize: createTile() }),
      },
      {
        name: 'cv.imgproc.createCLAHE()',
        guard: () => typeof (cv as any).imgproc?.createCLAHE === 'function',
        factory: () => (cv as any).imgproc.createCLAHE(),
      },
      {
        name: 'cv.xphoto.createCLAHE(clip, Size)',
        guard: () => typeof (cv as any).xphoto?.createCLAHE === 'function',
        factory: () => (cv as any).xphoto.createCLAHE(clipLimit, createTile()),
      },
      {
        name: 'cv.xphoto.createCLAHE(options)',
        guard: () => typeof (cv as any).xphoto?.createCLAHE === 'function',
        factory: () => (cv as any).xphoto.createCLAHE({ clipLimit, tileGridSize: createTile() }),
      },
      {
        name: 'cv.xphoto.createCLAHE()',
        guard: () => typeof (cv as any).xphoto?.createCLAHE === 'function',
        factory: () => (cv as any).xphoto.createCLAHE(),
      },
      {
        name: 'cv.ximgproc.createCLAHE(clip, Size)',
        guard: () => typeof (cv as any).ximgproc?.createCLAHE === 'function',
        factory: () => (cv as any).ximgproc.createCLAHE(clipLimit, createTile()),
      },
      {
        name: 'cv.ximgproc.createCLAHE(options)',
        guard: () => typeof (cv as any).ximgproc?.createCLAHE === 'function',
        factory: () => (cv as any).ximgproc.createCLAHE({ clipLimit, tileGridSize: createTile() }),
      },
      {
        name: 'cv.ximgproc.createCLAHE()',
        guard: () => typeof (cv as any).ximgproc?.createCLAHE === 'function',
        factory: () => (cv as any).ximgproc.createCLAHE(),
      },
      {
        name: 'cv.createCLAHE(clip, Size)',
        guard: () => typeof cv.createCLAHE === 'function',
        factory: () => cv.createCLAHE(clipLimit, createTile()),
      },
      {
        name: 'cv.createCLAHE(options)',
        guard: () => typeof cv.createCLAHE === 'function',
        factory: () => cv.createCLAHE({ clipLimit, tileGridSize: createTile() }),
      },
      {
        name: 'cv.createCLAHE()',
        guard: () => typeof cv.createCLAHE === 'function',
        factory: () => cv.createCLAHE(),
      },
      {
        name: 'new cv.CLAHE(clip, Size)',
        guard: () => typeof (cv as any).CLAHE === 'function',
        factory: () => new (cv as any).CLAHE(clipLimit, createTile()),
      },
      {
        name: 'new cv.CLAHE(options)',
        guard: () => typeof (cv as any).CLAHE === 'function',
        factory: () => new (cv as any).CLAHE({ clipLimit, tileGridSize: createTile() }),
      },
      {
        name: 'new cv.CLAHE() + setters',
        guard: () => typeof (cv as any).CLAHE === 'function',
        factory: () => {
          const inst = new (cv as any).CLAHE();
          inst.setClipLimit?.(clipLimit);
          inst.setTilesGridSize?.(createTile());
          return inst;
        },
      },
      {
        name: 'cv.createCLAHE(clipLimit only)',
        guard: () => typeof cv.createCLAHE === 'function',
        factory: () => cv.createCLAHE(clipLimit),
      },
    ];

    const methods: Array<{ name: string; factory: () => any; index: number }> = [];

    methodDefinitions.forEach((definition, definitionIndex) => {
      let available = true;
      if (typeof definition.guard === 'function') {
        try {
          available = Boolean(definition.guard());
        } catch (error) {
          const err = error as Error & { constructor?: { name?: string } };
          errors.push({
            index: `${definitionIndex}:guard`,
            method: definition.name,
            name: err?.name ?? 'Error',
            message: err?.message ?? String(err),
            constructor: err?.constructor?.name ?? 'unknown',
            stack: typeof err?.stack === 'string' ? err.stack.split('\n')[0] : 'guard check failed',
          });
          available = false;
        }
      }

      if (!available) {
        errors.push({
          index: definitionIndex.toString(),
          method: definition.name,
          name: 'Unavailable',
          message: 'CLAHE factory guard returned false',
          constructor: 'Guard',
          stack: 'guard returned false',
        });
        return;
      }

      methods.push({
        name: definition.name,
        factory: definition.factory,
        index: definitionIndex,
      });
    });

    let attempts = 0;

    const createSampleMat = () => new cv.Mat(32, 32, desiredType, 128);

    for (const method of methods) {
      const methodIndex = method.index;
      let instance: any = null;
      let sampleInput: MatLike | null = null;
      let sampleOutput: MatLike | null = null;
      let sampleDest: MatLike | null = null;

      if (typeof method.factory !== 'function') {
        continue;
      }

      try {
        attempts += 1;
        instance = method.factory();
        if (!instance) {
          throw new Error('CLAHE factory returned null/undefined');
        }

        const applyMethod = this.discoverClaheApplyMethod(instance);
        if (!applyMethod || typeof instance[applyMethod] !== 'function') {
          throw new Error('CLAHE instance missing apply-like method');
        }

        sampleInput = createSampleMat();
        sampleOutput = instance[applyMethod](sampleInput);
        if (!this.isMatLike(sampleOutput)) {
          this.releaseMat(sampleOutput);
          sampleDest = new cv.Mat();
          const maybeVoid = instance[applyMethod](sampleInput, sampleDest);
          if (this.isMatLike(maybeVoid)) {
            sampleOutput = maybeVoid;
          } else if (this.isMatLike(sampleDest)) {
            sampleOutput = sampleDest;
            sampleDest = null;
          } else {
            throw new Error('CLAHE method did not produce output');
          }
        }

        this.releaseMat(sampleOutput !== sampleInput ? sampleOutput : null);
        this.releaseMat(sampleInput);
        this.releaseMat(sampleDest);
        instance.delete?.();

        this.logger.debug(
          `[ElementDetectorService] CLAHE method ${methodIndex} successful (${method.name}) using '${applyMethod}'`,
        );

        return {
          success: true,
          provider: () => {
            if (typeof method.factory !== 'function') {
              throw new Error(`CLAHE provider ${method.name} became unavailable`);
            }
            const created = method.factory();
            if (!created) {
              throw new Error(`CLAHE provider ${method.name} returned null`);
            }
            const methodName = this.discoverClaheApplyMethod(created) ?? applyMethod;
            if (typeof created[methodName] !== 'function') {
              throw new Error(`CLAHE provider ${method.name} lost method ${methodName}`);
            }
            return { instance: created, method: methodName, source: method.name };
          },
          methodIndex,
          methodName: method.name,
          applyMethod,
          errors,
          attempts,
        };
      } catch (error) {
        const err = error as Error & { constructor?: { name?: string } };
        const info = {
          index: methodIndex.toString(),
          method: method.name,
          name: err?.name ?? 'Error',
          message: err?.message ?? String(err),
          constructor: err?.constructor?.name ?? 'unknown',
          stack: typeof err?.stack === 'string' ? err.stack.split('\n')[0] : 'no stack',
        };
        errors.push(info);
        try {
          this.logger.debug(`[ElementDetectorService] CLAHE method failed (${method.name}): ${info.message}`);
        } catch {
          /* noop */
        }
      } finally {
        this.releaseMat(sampleOutput);
        this.releaseMat(sampleInput);
        this.releaseMat(sampleDest);
        try {
          instance?.delete?.();
        } catch (deleteError) {
          const delErr = deleteError as Error & { constructor?: { name?: string } };
          const deleteInfo = {
            index: `${methodIndex}:delete`,
            method: method.name,
            name: delErr?.name ?? 'Error',
            message: delErr?.message ?? String(delErr),
            constructor: delErr?.constructor?.name ?? 'unknown',
            stack: typeof delErr?.stack === 'string' ? delErr.stack.split('\n')[0] : 'no stack',
          };
          errors.push(deleteInfo);
          try {
            this.logger.debug(
              `[ElementDetectorService] CLAHE method cleanup failed (${method.name}): ${deleteInfo.message}`,
            );
          } catch {
            /* noop */
          }
        }
      }
    }

    try {
      const sizeTest = new cv.Size(8, 8);
      this.logger.debug(
        `[ElementDetectorService] cv.Size constructor works (width=${sizeTest.width}, height=${sizeTest.height})`,
      );
    } catch (error) {
      const err = error as Error & { constructor?: { name?: string } };
      const sizeInfo = {
        index: 'cv.Size',
        method: 'new cv.Size(8, 8)',
        name: err?.name ?? 'Error',
        message: err?.message ?? String(err),
        constructor: err?.constructor?.name ?? 'unknown',
        stack: typeof err?.stack === 'string' ? err.stack.split('\n')[0] : 'no stack',
      };
      errors.push(sizeInfo);
      try {
        this.logger.debug(
          `[ElementDetectorService] cv.Size constructor failed: ${sizeInfo.message}`,
        );
      } catch {
        /* noop */
      }
    }

    const fallbackProvider = this.createClaheFallbackProvider();
    if (fallbackProvider) {
      errors.push({
        index: 'fallback',
        method: 'Histogram CLAHE fallback',
        name: 'Fallback',
        message: 'Native CLAHE bindings unavailable; using histogram-based fallback',
        constructor: 'Fallback',
        stack: 'fallback selected',
      });
      this.logger.warn(
        '[ElementDetectorService] Native CLAHE bindings unavailable; using histogram fallback provider',
      );
      return {
        success: true,
        provider: fallbackProvider,
        methodIndex: null,
        methodName: 'Histogram CLAHE fallback',
        applyMethod: 'apply',
        errors,
        attempts,
      };
    }

    return {
      success: false,
      provider: null,
      methodIndex: null,
      methodName: undefined,
      applyMethod: undefined,
      errors,
      attempts,
    };
  }

  private detectMorphologyCapability(): {
    success: boolean;
    provider: (() => MorphologyProviderResult) | null;
    methodIndex: number | null;
    methodName?: string;
    applyMethod?: string;
    errors: Array<Record<string, string>>;
    attempts: number;
  } {
    if (!hasCv) {
      return {
        success: false,
        provider: null,
        methodIndex: null,
        methodName: undefined,
        applyMethod: undefined,
        errors: [{ reason: 'OpenCV unavailable' }],
        attempts: 0,
      };
    }

    const createSampleMat = () => {
      // Use enhanced morphology-compatible Mat creation for OpenCV 4.8
      const mat = this.createMorphologyMat(32, 32);
      if (mat) {
        return mat;
      }
      
      // Fallback: create basic Mat with buffer initialization for compatibility
      const desiredType = typeof cv.CV_8UC1 === 'number' ? cv.CV_8UC1 : (cv as any).CV_8UC1 ?? 0;
      try {
        const data = new Uint8Array(32 * 32);
        data.fill(128);
        return new cv.Mat(32, 32, desiredType, Buffer.from(data) as any);
      } catch {
        return new cv.Mat(32, 32, desiredType, 128);
      }
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
          morphologyEx: (src: MatLike, morphType: number, kernel: any) => cv.morphologyEx(src, morphType, kernel),
        }),
      },
      {
        name: 'cv.imgproc.morphologyEx(src, morphType, kernel)',
        guard: () => typeof (cv as any).imgproc?.morphologyEx === 'function',
        factory: () => ({
          morphologyEx: (src: MatLike, morphType: number, kernel: any) => (cv as any).imgproc.morphologyEx(src, morphType, kernel),
        }),
      },
      {
        name: 'src.morphologyEx(morphType, kernel)',
        guard: () => {
          try {
            const testMat = createSampleMat();
            const hasMethod = typeof (testMat as any).morphologyEx === 'function';
            this.releaseMat(testMat);
            return hasMethod;
          } catch {
            return false;
          }
        },
        factory: () => ({
          morphologyEx: (src: MatLike, morphType: number, kernel: any) => {
            const srcMat = src as any;
            const dst = new cv.Mat(srcMat.rows, srcMat.cols, srcMat.type);
            srcMat.morphologyEx(dst, morphType, kernel);
            return dst;
          },
        }),
      },
      {
        name: 'cv.Mat.morphologyEx(src, morphType, kernel)',
        guard: () => typeof (cv.Mat as any)?.morphologyEx === 'function',
        factory: () => ({
          morphologyEx: (src: MatLike, morphType: number, kernel: any) => (cv.Mat as any).morphologyEx(src, morphType, kernel),
        }),
      },
    ];

    const methods: Array<{ name: string; factory: () => any; index: number }> = [];
    const errors: Array<Record<string, string>> = [];

    methodDefinitions.forEach((definition, definitionIndex) => {
      let available = true;
      if (typeof definition.guard === 'function') {
        try {
          available = Boolean(definition.guard());
        } catch (error) {
          const err = error as Error & { constructor?: { name?: string } };
          errors.push({
            index: `${definitionIndex}:guard`,
            method: definition.name,
            name: err?.name ?? 'Error',
            message: err?.message ?? String(err),
            constructor: err?.constructor?.name ?? 'unknown',
            stack: typeof err?.stack === 'string' ? err.stack.split('\n')[0] : 'guard check failed',
          });
          available = false;
        }
      }

      if (!available) {
        errors.push({
          index: definitionIndex.toString(),
          method: definition.name,
          name: 'Unavailable',
          message: 'Morphology factory guard returned false',
          constructor: 'Guard',
          stack: 'guard returned false',
        });
        return;
      }

      methods.push({
        name: definition.name,
        factory: definition.factory,
        index: definitionIndex,
      });
    });

    let attempts = 0;

    for (const method of methods) {
      const methodIndex = method.index;
      let instance: any = null;
      let sampleInput: MatLike | null = null;
      let sampleOutput: MatLike | null = null;
      let kernel: any = null;

      if (typeof method.factory !== 'function') {
        continue;
      }

      try {
        attempts += 1;
        instance = method.factory();
        if (!instance || typeof instance.morphologyEx !== 'function') {
          throw new Error('Morphology factory returned invalid instance');
        }

        sampleInput = createSampleMat();
        if (!sampleInput) {
          throw new Error('Failed to create sample Mat for morphology testing');
        }
        
        // Use enhanced Mat validation for OpenCV 4.8 compatibility
        const validatedInput = this.ensureMorphologyMat(sampleInput);
        if (!validatedInput) {
          throw new Error('Failed to create OpenCV 4.8 compatible Mat for morphology testing');
        }
        
        kernel = createKernel();
        if (!kernel) {
          throw new Error('Failed to create morphology kernel');
        }

        // CRITICAL: Validate kernel is also a proper Mat instance for OpenCV 4.8
        const validatedKernel = this.ensureMorphologyMat(kernel);
        if (!validatedKernel) {
          throw new Error('Failed to create OpenCV 4.8 compatible kernel Mat');
        }

        sampleOutput = instance.morphologyEx(validatedInput!, morphClose, validatedKernel!);
        
        // If we created a new validated input, we need to clean it up
        if (validatedInput !== sampleInput) {
          this.releaseMat(validatedInput!);
        }
        if (!this.isValidMat(sampleOutput)) {
          throw new Error('Morphology method did not produce valid Mat output');
        }

        this.releaseMat(sampleOutput !== sampleInput ? sampleOutput : null);
        this.releaseMat(sampleInput);
        this.releaseMat(kernel);

        this.logger.debug(
          `[ElementDetectorService] Morphology method ${methodIndex} successful (${method.name})`,
        );

        return {
          success: true,
          provider: () => {
            if (typeof method.factory !== 'function') {
              throw new Error(`Morphology provider ${method.name} became unavailable`);
            }
            const created = method.factory();
            if (!created || typeof created.morphologyEx !== 'function') {
              throw new Error(`Morphology provider ${method.name} returned invalid instance`);
            }
            return { 
              instance: created, 
              method: 'morphologyEx', 
              source: method.name,
              operation: 'morphologyEx'
            };
          },
          methodIndex,
          methodName: method.name,
          applyMethod: 'morphologyEx',
          errors,
          attempts,
        };
      } catch (error) {
        const err = error as Error & { constructor?: { name?: string } };
        const info = {
          index: methodIndex.toString(),
          method: method.name,
          name: err?.name ?? 'Error',
          message: err?.message ?? String(err),
          constructor: err?.constructor?.name ?? 'unknown',
          stack: typeof err?.stack === 'string' ? err.stack.split('\n')[0] : 'no stack',
        };
        errors.push(info);
        try {
          this.logger.debug(`[ElementDetectorService] Morphology method failed (${method.name}): ${info.message}`);
        } catch {
          /* noop */
        }
      } finally {
        this.releaseMat(sampleOutput);
        this.releaseMat(sampleInput);
        // Clean up kernel (original will be released, validated kernel was already cleaned up in try block)
        this.releaseMat(kernel);
      }
    }

    return {
      success: false,
      provider: null,
      methodIndex: null,
      methodName: undefined,
      applyMethod: undefined,
      errors,
      attempts,
    };
  }

  private createClaheFallbackProvider(): (() => ClaheProviderResult) | null {
    if (!hasCv || !cv?.Mat) {
      return null;
    }

    const createInstance = () => ({
      apply: (input: MatLike) => {
        const enhanced = this.applyHistogramFallbacks(
          input,
          'claheFallback:histogramEqualisation',
        );

        if (!enhanced || !this.isMatLike(enhanced)) {
          return this.safeMatClone(input, 'claheFallback:cloneOnNull') ?? input;
        }

        if (enhanced === input) {
          const clone = this.safeMatClone(input, 'claheFallback:cloneOnSame');
          return clone ?? input;
        }

        return enhanced;
      },
      delete: () => {
        /* no-op */
      },
    });

    return () => ({
      instance: createInstance(),
      method: 'apply',
      source: 'Histogram CLAHE fallback',
    });
  }

  private discoverClaheApplyMethod(clahe: any): string | null {
    if (!clahe) {
      return null;
    }

    const candidates = [
      'apply',
      'process',
      'run',
      'execute',
      'enhance',
      'filter',
      'compute',
      'adapt',
      'equalize',
      'equalizeHist',
    ];

    for (const candidate of candidates) {
      if (typeof clahe[candidate] === 'function') {
        this.logger.debug(`[ElementDetectorService] Found CLAHE apply method candidate: ${candidate}`);
        return candidate;
      }
    }

    try {
      const availableMethods = this.listFunctionProperties(clahe);
      if (availableMethods.length > 0) {
        this.logger.debug(
          `[ElementDetectorService] Available CLAHE methods: ${availableMethods.join(', ')}`,
        );
      }
    } catch (error) {
      this.logger.debug(
        `[ElementDetectorService] Failed to enumerate CLAHE methods: ${(error as Error)?.message ?? String(error)}`,
      );
    }

    return null;
  }

  private listFunctionProperties(target: any): string[] {
    const methods = new Set<string>();
    let proto: any = target;
    while (proto && proto !== Object.prototype) {
      for (const prop of Object.getOwnPropertyNames(proto)) {
        try {
          if (typeof proto[prop] === 'function') {
            methods.add(prop);
          }
        } catch {
          // Ignore accessor exceptions
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
    return Array.from(methods).sort();
  }

  async detectElements(
    screenshotBuffer: Buffer,
    config: DetectionConfig = this.getDefaultConfig(),
  ): Promise<DetectedElement[]> {
    const detectionPromises: Array<Promise<DetectedElement[]>> = [];

    if (config.enableOCR) {
      detectionPromises.push(this.runOcrPipeline(screenshotBuffer, config.searchRegion));
    }

    if (config.enableTemplateMatching) {
      const templateDetector = await this.getTemplateDetector();
      if (templateDetector) {
        detectionPromises.push(templateDetector.detect(screenshotBuffer, config.searchRegion));
      }
    }

    if (config.enableEdgeDetection) {
      const edgeDetector = await this.getEdgeDetector();
      if (edgeDetector) {
        detectionPromises.push(edgeDetector.detect(screenshotBuffer, config.searchRegion));
      }
    }

    const detectionResults = await Promise.all(detectionPromises);
    const allElements = detectionResults.flat();
    const mergedElements = this.mergeOverlappingElements(allElements);

    return mergedElements.filter((el) => el.confidence >= config.confidenceThreshold);
  }

  async detectUniversalElements(
    screenshotBuffer: Buffer,
    config: DetectionConfig = this.getDefaultConfig(),
  ): Promise<UniversalDetectionResult> {
    const start = this.getNow();

    const detectedElements = await this.detectElements(screenshotBuffer, config);
    const universalElements: UniversalUIElement[] = [];

    for (const element of detectedElements) {
      const universal = await this.toUniversalElement(element, config.searchRegion);
      if (universal) {
        universalElements.push(universal);
      }
    }

    const method = this.resolveUniversalDetectionMethod(detectedElements);
    const processingTime = Math.max(0, Math.round(this.getNow() - start));

    return {
      elements: universalElements,
      processingTime,
      method,
    };
  }

  async performOCR(
    screenshotBuffer: Buffer,
    region?: BoundingBox,
  ): Promise<DetectedElement[]> {
    return this.runOcrPipeline(screenshotBuffer, region);
  }

  async detectElementsUniversal(screenshotBuffer: Buffer): Promise<UniversalUIElement[]> {
    const project = (elements: UniversalUIElement[]): UniversalUIElement[] =>
      elements.map((element) => ({
        ...element,
        text: element.text ?? '',
      }));

    if (!this.universalDetector) {
      this.logger.warn('UniversalDetectorService unavailable; falling back to OCR-based detection.');
      const fallback = await this.detectUniversalElements(screenshotBuffer);
      return project(fallback.elements);
    }

    try {
      const result = await this.universalDetector.detectElements(screenshotBuffer);
      return project(result.elements);
    } catch (error) {
      this.logger.error('Universal detection failed', (error as Error)?.stack);
      return [];
    }
  }

  async findElementByDescription(
    elements: DetectedElement[],
    description: string,
  ): Promise<DetectedElement | null> {
    const scoredElements = elements.map((element) => ({
      element,
      score: this.calculateDescriptionMatch(element, description),
    }));

    scoredElements.sort((a, b) => b.score - a.score);

    if (scoredElements.length > 0 && scoredElements[0].score > 0.6) {
      return scoredElements[0].element;
    }

    return null;
  }

  async getClickCoordinates(element: DetectedElement): Promise<ClickTarget> {
    const { coordinates } = element;

    let targetX = coordinates.centerX;
    let targetY = coordinates.centerY;

    switch (element.type) {
      case 'input':
        targetX = coordinates.x + coordinates.width * 0.1;
        break;
      case 'dropdown':
        targetX = coordinates.x + coordinates.width * 0.9;
        break;
      default:
        break;
    }

    const fallbackCoordinates = [
      { x: coordinates.centerX, y: coordinates.centerY },
      { x: coordinates.x + 10, y: coordinates.y + 10 },
      { x: coordinates.x + coordinates.width - 10, y: coordinates.centerY },
    ];

    return {
      coordinates: { x: Math.round(targetX), y: Math.round(targetY) },
      confidence: element.confidence,
      method: element.metadata.detectionMethod,
      fallbackCoordinates,
    };
  }

  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.workerPromise = null;
    }
  }

  private async runOcrPipeline(
    screenshotBuffer: Buffer,
    region?: BoundingBox,
  ): Promise<DetectedElement[]> {
    if (!Buffer.isBuffer(screenshotBuffer) || screenshotBuffer.length === 0) {
      warnOnce('Received invalid screenshot buffer for OCR processing');
      return [];
    }

    const worker = await this.getWorker();
    if (!worker) {
      warnOnce('Tesseract worker unavailable; OCR step skipped');
      return [];
    }

    const decoded = this.decodeImage(screenshotBuffer);
    if (!decoded) {
      return [];
    }

    const regionResult = this.extractRegion(decoded, region);
    if (!regionResult) {
      return [];
    }

    const { image: regionMat, offsetX, offsetY } = regionResult;
    if (!this.isValidSize(regionMat)) {
      return [];
    }

    const strategies = this.buildStrategies();

    const baseBuffer = this.encodeMat(regionMat);
    if (!baseBuffer || baseBuffer.length === 0) {
      warnOnce('Unable to encode region for OCR preprocessing');
      return [];
    }

    const attemptResults: {
      name: string;
      elements: DetectedElement[];
      averageConfidence: number;
    }[] = [];

    for (const strategy of strategies) {
      try {
        const processedBuffer = await this.preprocessImageForOCR(baseBuffer, strategy.preprocessMethod);
        if (!processedBuffer || processedBuffer.length === 0) {
          continue;
        }

        const workerAny = worker as Worker & {
          setParameters?: (params: Record<string, string>) => Promise<void>;
        };

        if (typeof workerAny.setParameters === 'function') {
          await workerAny.setParameters(strategy.tessParams);
        }

        const { data } = await worker.recognize(processedBuffer);
        const words = (data?.words ?? []).filter(
          (word) => (word.confidence ?? 0) >= strategy.minConfidence,
        );
        if (words.length === 0) {
          continue;
        }

        const elements = this.wordsToElements(words, offsetX, offsetY, 1, strategy.name);

        if (elements.length === 0) {
          continue;
        }

        const averageConfidence =
          elements.reduce((sum, element) => sum + element.confidence, 0) / elements.length;

        attemptResults.push({ name: strategy.name, elements, averageConfidence });

        if (averageConfidence >= this.ocrConfidenceEarlyExit) {
          break;
        }
      } catch (error) {
        warnOnce(`OCR strategy ${strategy.name} failed`, error);
        continue;
      }
    }

    if (attemptResults.length === 0) {
      return [];
    }

    attemptResults.sort((a, b) => b.averageConfidence - a.averageConfidence);
    return attemptResults[0].elements;
  }

  private buildStrategies(): OcrStrategy[] {
    const strategies: OcrStrategy[] = [
      {
        name: 'clahe_psm8',
        preprocessMethod: 'clahe_psm8',
        tessParams: {
          tessedit_pageseg_mode: '8',
          tessedit_char_whitelist: DEFAULT_CHAR_WHITELIST,
          preserve_interword_spaces: '1',
          user_defined_dpi: '320',
        },
        minConfidence: 65,
      },
      {
        name: 'denoise_psm6',
        preprocessMethod: 'denoise_psm6',
        tessParams: {
          tessedit_pageseg_mode: '6',
          tessedit_char_whitelist: DEFAULT_CHAR_WHITELIST,
          user_defined_dpi: '300',
        },
        minConfidence: 60,
      },
      {
        name: 'edge_psm7',
        preprocessMethod: 'edge_psm7',
        tessParams: {
          tessedit_pageseg_mode: '7',
          tessedit_char_whitelist: DEFAULT_CHAR_WHITELIST,
          tessedit_char_blacklist: '@{}',
          user_defined_dpi: '340',
        },
        minConfidence: 55,
      },
      {
        name: 'basic_psm8',
        preprocessMethod: 'basic_psm8',
        tessParams: {
          tessedit_pageseg_mode: '8',
          tessedit_char_whitelist: DEFAULT_CHAR_WHITELIST,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
        },
        minConfidence: 65,
      },
    ];

    if (!hasCv) {
      // When OpenCV is unavailable, fall back to the simplest preprocessing path first
      return strategies.filter((strategy) => strategy.name === 'basic_psm8');
    }

    return strategies;
  }

  private decodeImage(buffer: Buffer): MatLike | null {
    if (!hasCv) {
      return null;
    }
    let conversion: MatConversion | null = null;
    try {
      conversion = this.ensureMat(buffer, 'decodeImage');
      return conversion.mat;
    } catch (error) {
      warnOnce('Failed to decode screenshot buffer', error);
      return null;
    } finally {
      // When ensureMat constructs a new Mat for us, the caller owns it.
      if (conversion?.needsRelease) {
        // Prevent automatic release here; transfer ownership by flagging false.
        conversion.needsRelease = false;
      }
    }
  }

  private extractRegion(
    mat: MatLike,
    region?: BoundingBox,
  ): { image: MatLike; offsetX: number; offsetY: number } | null {
    if (!hasCv) {
      return { image: mat, offsetX: 0, offsetY: 0 };
    }

    if (!region) {
      const clone = this.safeClone(mat);
      return { image: clone ?? mat, offsetX: 0, offsetY: 0 };
    }

    const x = Math.max(0, Math.floor(region.x));
    const y = Math.max(0, Math.floor(region.y));
    const width = Math.max(1, Math.floor(region.width));
    const height = Math.max(1, Math.floor(region.height));

    if (mat.cols < x + width || mat.rows < y + height) {
      warnOnce('Requested OCR region exceeds screenshot bounds');
      return null;
    }

    try {
      if (typeof (mat as any).getRegion !== 'function') {
        warnOnce('Mat#getRegion unavailable; using full image for OCR');
        const clone = this.safeClone(mat);
        return { image: clone ?? mat, offsetX: 0, offsetY: 0 };
      }
      const rect = new cv.Rect(x, y, width, height);
      const roi = (mat as any).getRegion(rect);
      const clone = this.safeClone(roi);
      return { image: clone ?? roi, offsetX: x, offsetY: y };
    } catch (error) {
      warnOnce('Failed to extract OCR region', error);
      return null;
    }
  }

  private isValidSize(mat: MatLike): boolean {
    if (!mat || typeof mat.cols !== 'number' || typeof mat.rows !== 'number') {
      return false;
    }
    if (mat.cols < MIN_WIDTH || mat.rows < MIN_HEIGHT) {
      return false;
    }
    return true;
  }

  private safeClone(mat: MatLike | null | undefined, source = 'safeClone'): MatLike | null {
    return this.safeMatClone(mat, source);
  }

  private safeMatClone(mat: MatLike | null | undefined, source = 'safeMatClone'): MatLike | null {
    if (!mat) {
      return null;
    }

    if (!hasCv || !cv?.Mat) {
      if (typeof (mat as any).clone === 'function') {
        return (mat as any).clone();
      }
      if (typeof (mat as any).copy === 'function') {
        return (mat as any).copy();
      }
      return null;
    }

    let conversion: MatConversion | null = null;
    try {
      conversion = this.ensureMat(mat, source);
      const candidate = conversion.mat as any;
      if (typeof candidate.clone === 'function') {
        return candidate.clone();
      }
      if (typeof candidate.copy === 'function') {
        return candidate.copy();
      }
      return new cv.Mat(candidate);
    } catch (error) {
      warnOnce(`${source} failed`, error);
      if (typeof (mat as any).clone === 'function') {
        return (mat as any).clone();
      }
      if (typeof (mat as any).copy === 'function') {
        return (mat as any).copy();
      }
      return null;
    } finally {
      if (conversion?.needsRelease) {
        this.releaseMat(conversion.mat);
      }
    }
  }

  private ensureMat(image: unknown, source = 'ensureMat'): MatConversion {
    if (!hasCv || !cv?.Mat) {
      throw new Error(`OpenCV Mat unavailable while processing ${source}`);
    }

    if (!image) {
      throw new Error(`Received empty image value for ${source}`);
    }

    if (image instanceof cv.Mat) {
      return { mat: image as MatLike, needsRelease: false };
    }

    if (Buffer.isBuffer(image)) {
      try {
        const decoded = decodeImageBuffer(
          cv as typeof import('@u4/opencv4nodejs'),
          image,
          {
            source,
            warnOnce: warnOnce,
          },
        );
        if (!decoded) {
          throw new Error('decodeImageBuffer returned null');
        }
        return { mat: decoded as MatLike, needsRelease: true };
      } catch (error) {
        throw new Error(`Failed to decode buffer for ${source}: ${(error as Error)?.message ?? error}`);
      }
    }

    if (this.isCanvasImageData(image)) {
      return this.createMatFromImageData(image, source);
    }

    if (this.isMatLike(image)) {
      try {
        const cloned = new cv.Mat(image as any);
        return { mat: cloned as MatLike, needsRelease: true };
      } catch (error) {
        throw new Error(`Failed to construct Mat from MatLike for ${source}: ${(error as Error)?.message ?? error}`);
      }
    }

    throw new Error(`Unsupported image type for ${source}: ${typeof image}`);
  }

  private createMatFromImageData(image: CanvasImageData, source: string): MatConversion {
    if (!hasCv || !cv?.Mat) {
      throw new Error(`OpenCV unavailable for ${source}`);
    }

    try {
      if (typeof (cv as any).matFromImageData === 'function') {
        const mat = (cv as any).matFromImageData(image);
        return { mat: mat as MatLike, needsRelease: true };
      }

      const channels = image.data.length / (image.width * image.height);
      const type = channels === 4
        ? (typeof cv.CV_8UC4 === 'number' ? cv.CV_8UC4 : (cv as any).CV_8UC4 ?? 24)
        : (typeof cv.CV_8UC3 === 'number' ? cv.CV_8UC3 : (cv as any).CV_8UC3 ?? 16);

      const buffer = Buffer.from(image.data.buffer ? new Uint8Array(image.data.buffer) : image.data as ArrayLike<number>);
      const matWithChannels = new cv.Mat(image.height, image.width, type, buffer as any);

      if (channels === 4 && typeof (matWithChannels as any).cvtColor === 'function') {
        const rgbaToBgr = typeof cv.COLOR_RGBA2BGR === 'number'
          ? cv.COLOR_RGBA2BGR
          : typeof cv.COLOR_BGRA2BGR === 'number'
            ? cv.COLOR_BGRA2BGR
            : typeof cv.COLOR_RGBA2RGB === 'number'
              ? cv.COLOR_RGBA2RGB
              : null;

        if (rgbaToBgr !== null) {
          const converted = (matWithChannels as any).cvtColor(rgbaToBgr);
          this.releaseMat(matWithChannels);
          return { mat: converted as MatLike, needsRelease: true };
        }
      }

      return { mat: matWithChannels as MatLike, needsRelease: true };
    } catch (error) {
      throw new Error(`Failed to convert ImageData to Mat for ${source}: ${(error as Error)?.message ?? error}`);
    }
  }

  private releaseConversion(conversion: MatConversion | null | undefined, preserve?: MatLike): void {
    if (!conversion?.needsRelease || !conversion.mat) {
      return;
    }

    if (preserve && conversion.mat === preserve) {
      return;
    }

    this.releaseMat(conversion.mat);
  }

  private isCanvasImageData(value: unknown): value is CanvasImageData {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as Partial<CanvasImageData>;
    return (
      typeof candidate.width === 'number' &&
      typeof candidate.height === 'number' &&
      candidate.data instanceof Uint8ClampedArray
    );
  }

  private toGray(mat: MatLike): MatLike {
    if (!hasCv || typeof mat.cvtColor !== 'function') {
      return mat;
    }
    try {
      return mat.cvtColor(cv.COLOR_BGR2GRAY ?? cv.COLOR_RGB2GRAY ?? 6);
    } catch (error) {
      warnOnce('cvtColor to grayscale failed', error);
      return mat;
    }
  }

  private createTileSize(size: number): any {
    if (!hasCv) {
      return { width: size, height: size };
    }

    try {
      if (typeof cv.Size === 'function') {
        return new cv.Size(size, size);
      }

      if (typeof (cv as any).size === 'function') {
        return (cv as any).size(size, size);
      }
    } catch (error) {
      warnOnce('Tile size construction failed', error);
    }

    return { width: size, height: size };
  }

  private encodeMat(mat: MatLike): Buffer | null {
    if (!hasCv) {
      return null;
    }
    let conversion: MatConversion | null = null;
    try {
      conversion = this.ensureMat(mat, 'encodeMat');
      return cv.imencode('.png', conversion.mat) as any;
    } catch (error) {
      warnOnce('Failed to encode processed image for OCR', error);
      return null;
    } finally {
      this.releaseConversion(conversion);
    }
  }

  private releaseMat(mat: MatLike | null | undefined): void {
    if (!mat) {
      return;
    }

    const candidate = mat as any;

    // Note: In @u4/opencv4nodejs v7.1.2, Mat objects are garbage collected automatically
    // No manual cleanup needed with .delete() or .release()
    try {
      // Placeholder for future cleanup if needed
    } catch (error) {
      warnOnce('Mat cleanup skipped', error);
    }
  }

  private isMatLike(value: unknown): value is MatLike {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as any;
    if (candidate.rows !== undefined && candidate.cols !== undefined) {
      return true;
    }

    if (hasCv && typeof cv.Mat === 'function') {
      return value instanceof cv.Mat;
    }

    return false;
  }

  /**
   * Enhanced Mat validation for OpenCV 4.8 strict type checking
   */
  private isValidMat(value: unknown): value is MatLike {
    if (!this.isMatLike(value)) {
      return false;
    }

    const mat = value as any;
    
    // Validate essential Mat properties first
    if (typeof mat.rows !== 'number' || typeof mat.cols !== 'number') {
      return false;
    }

    if (mat.rows <= 0 || mat.cols <= 0) {
      return false;
    }

    // OpenCV 4.8 requires proper Mat instance validation for native operations
    if (hasCv && typeof cv.Mat === 'function') {
      // For morphology operations, prefer actual cv.Mat instances
      if (!(mat instanceof cv.Mat)) {
        // Allow Mat-like objects but flag them for conversion
        return this.hasMatInterface(mat);
      }
    }

    // Check if Mat is not empty (OpenCV 4.8 requirement)
    try {
      if (typeof mat.empty === 'function' && mat.empty()) {
        return false;
      }
    } catch {
      // If empty() check fails, Mat might be invalid but could still be usable
      // Don't fail validation here, let the calling code handle it
    }

    // Additional OpenCV 4.8 validation
    try {
      if (typeof mat.type === 'function') {
        const matType = mat.type();
        // Ensure type is a valid OpenCV type
        if (typeof matType !== 'number' || matType < 0) {
          return false;
        }
      }
    } catch {
      // Type check failed, but Mat might still be valid
    }

    return true;
  }

  /**
   * Check if object has essential Mat interface methods
   */
  private hasMatInterface(obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    const requiredProps = ['rows', 'cols'];
    const optionalMethods = ['clone', 'copy', 'convertTo', 'type'];
    
    // Check required properties
    for (const prop of requiredProps) {
      if (typeof obj[prop] !== 'number') {
        return false;
      }
    }

    // Check if at least some optional methods exist
    const methodCount = optionalMethods.filter(method => typeof obj[method] === 'function').length;
    return methodCount >= 2; // Require at least 2 methods for Mat-like behavior
  }

  /**
   * Create a properly constructed Mat for morphology operations in OpenCV 4.8
   */
  private createMorphologyMat(rows: number = 32, cols: number = 32): MatLike | null {
    if (!hasCv || !cv?.Mat) {
      return null;
    }

    try {
      const desiredType = typeof cv.CV_8UC1 === 'number' ? cv.CV_8UC1 : (cv as any).CV_8UC1 ?? 0;
      
      // Method 1: Try with data buffer initialization (most reliable for OpenCV 4.8)
      try {
        const data = new Uint8Array(rows * cols);
        data.fill(128); // Fill with gray value
        const matWithData = new cv.Mat(rows, cols, desiredType, Buffer.from(data) as any);
        
        if (this.isValidMat(matWithData)) {
          return matWithData as MatLike;
        }
        this.releaseMat(matWithData);
      } catch (dataError) {
        // Continue to next method
      }
      
      // Method 2: Try basic Mat constructor
      try {
        const mat = new cv.Mat(rows, cols, desiredType);
        
        // Initialize with Scalar using our polyfill
        if (typeof mat.setTo === 'function') {
          // Use the Scalar polyfill we added
          const scalar = new cv.Scalar(128);
          if (scalar) {
            mat.setTo(scalar);
          }
        }

        if (this.isValidMat(mat)) {
          return mat as MatLike;
        }
        this.releaseMat(mat);
      } catch (basicError) {
        // Continue to next method
      }

      // Method 3: Try with zeros/ones initialization
      try {
        let mat: any = null;
        
        if (typeof cv.Mat.zeros === 'function') {
          mat = cv.Mat.zeros(rows, cols, desiredType);
        } else if (typeof cv.Mat.ones === 'function') {
          mat = cv.Mat.ones(rows, cols, desiredType);
          // Scale ones to gray value if possible
          if (typeof mat.mul === 'function') {
            const scaledMat = mat.mul(128);
            this.releaseMat(mat);
            mat = scaledMat;
          }
        }
        
        if (mat && this.isValidMat(mat)) {
          return mat as MatLike;
        }
        this.releaseMat(mat);
      } catch (zerosError) {
        // Final fallback handled below
      }

      // Method 4: Last resort - create minimal valid Mat
      const basicMat = new cv.Mat(rows, cols, desiredType);
      if (this.isValidMat(basicMat)) {
        return basicMat as MatLike;
      }
      this.releaseMat(basicMat);
      
      return null;
    } catch (error) {
      warnOnce('Failed to create morphology-compatible Mat', error);
      return null;
    }
  }

  /**
   * Ensure Mat is compatible with OpenCV 4.8 morphology operations
   * Updated to work with incomplete opencv4nodejs bindings (missing Mat.type())
   */
  private ensureMorphologyMat(input: MatLike): MatLike | null {
    if (!input || !this.isMatLike(input)) {
      return null;
    }

    if (!hasCv || !cv?.Mat) {
      return input;
    }

    try {
      // For OpenCV 4.8, ensure Mat is a proper cv.Mat instance
      if (!(input instanceof cv.Mat)) {
        // Try to convert to proper cv.Mat
        try {
          const converted = new cv.Mat(input as any);
          if (converted && this.isMatLike(converted)) {
            return converted as MatLike;
          }
          this.releaseMat(converted);
        } catch (conversionError) {
          // If conversion fails, try to use input as-is if it has basic Mat interface
          if (this.hasBasicMatInterface(input)) {
            return input;
          }
          return null;
        }
      }

      // Validate existing Mat properties (without using type() since it may be missing)
      const mat = input as any;
      
      // Check type compatibility for morphology (only if type() exists)
      if (typeof mat.type === 'function') {
        try {
          const matType = mat.type();
          const expectedType = typeof cv.CV_8UC1 === 'number' ? cv.CV_8UC1 : (cv as any).CV_8UC1 ?? 0;
          
          if (typeof matType === 'number' && matType !== expectedType) {
            // Convert to proper type if possible
            if (typeof mat.convertTo === 'function') {
              try {
                const converted = mat.convertTo(expectedType);
                if (converted && this.isValidMat(converted)) {
                  return converted as MatLike;
                }
                this.releaseMat(converted);
              } catch (convertError) {
                // Continue with original Mat if conversion fails
              }
            }
          }
        } catch (typeError) {
          // type() function exists but fails - continue with original Mat
        }
      }

      return input;
    } catch (error) {
      warnOnce('Failed to ensure morphology Mat compatibility', error);
      return input; // Return original Mat if all else fails
    }
  }

  /**
   * Check if object has basic Mat interface for incomplete opencv4nodejs bindings
   */
  private hasBasicMatInterface(obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    // Check essential properties
    if (typeof obj.rows !== 'number' || typeof obj.cols !== 'number') {
      return false;
    }

    // For morphology, we need at least one of these methods
    const morphologyMethods = ['morphologyEx'];
    const hasAnyMorphMethod = morphologyMethods.some(method => typeof obj[method] === 'function');
    
    return hasAnyMorphMethod;
  }


  private getChannelCount(mat: MatLike): number {
    const candidate = mat as MatLike & { channels?: number | (() => number) };
    try {
      if (typeof candidate.channels === 'function') {
        return candidate.channels();
      }
      if (typeof candidate.channels === 'number') {
        return candidate.channels;
      }
    } catch (error) {
      warnOnce('Channel count lookup failed', error);
    }
    return 0;
  }

  private async preprocessImageForOCR(
    imageBuffer: Buffer,
    method: string,
  ): Promise<Buffer> {
    if (!hasCv) {
      return this.preprocessImageCanvasBuffer(imageBuffer, method);
    }
    let baseConversion: MatConversion | null = null;
    let processed: MatLike | null = null;
    let processedIsBase = false;

    try {
      baseConversion = this.ensureMat(imageBuffer, `preprocessImageForOCR:${method}`);
      const baseMat = baseConversion.mat;

      if (method.includes('clahe')) {
        processed = await this.applyClahePreprocessing(baseMat);
      } else if (method.includes('denoise')) {
        processed = await this.applyDenoisePreprocessing(baseMat);
      } else if (method.includes('edge')) {
        processed = await this.applyEdgePreprocessing(baseMat);
      } else {
        processed = this.safeMatClone(baseMat, `preprocessImageForOCR:${method}:clone`) ?? baseMat;
      }

      processedIsBase = processed === baseMat;
      const encoded = this.encodeMat(processedIsBase ? baseMat : processed);
      if (!encoded) {
        throw new Error('Failed to encode processed Mat');
      }

      return encoded;
    } catch (error) {
      this.logger.error(
        `OCR preprocessing failed for method ${method}`,
        (error as Error)?.stack ?? (error as Error)?.message ?? String(error),
      );
      return this.preprocessImageCanvasBuffer(imageBuffer, method);
    } finally {
      if (processed && !processedIsBase) {
        this.releaseMat(processed);
      }
      if (baseConversion?.needsRelease) {
        this.releaseMat(baseConversion.mat);
      }
    }
  }

  private async applyClahePreprocessing(mat: MatLike): Promise<MatLike> {
    if (!hasCv) {
      return this.safeMatClone(mat, 'applyClahePreprocessing:noCv') ?? mat;
    }

    let baseConversion: MatConversion | null = null;
    let workingMat: MatLike | null = null;
    let workingNeedsRelease = false;
    let claheInstance: any;
    let output: MatLike | null = null;

    try {
      baseConversion = this.ensureMat(mat, 'applyClahePreprocessing');
      workingMat = baseConversion.mat;
      const desiredType =
        typeof cv.CV_8UC1 === 'number' ? cv.CV_8UC1 : (cv as any).CV_8UC1 ?? 0;

      const updateWorkingMat = (next: MatLike, markRelease: boolean) => {
        if (workingNeedsRelease && workingMat && workingMat !== next) {
          this.releaseMat(workingMat);
        }
        workingMat = next;
        workingNeedsRelease = markRelease;
      };

      let workingAny = workingMat as any;
      const channels = this.getChannelCount(workingMat);

      if (channels > 1 && typeof workingAny.cvtColor === 'function') {
        const gray = workingAny.cvtColor(cv.COLOR_BGR2GRAY ?? cv.COLOR_RGB2GRAY ?? 6);
        updateWorkingMat(gray, true);
        workingAny = workingMat as any;
      } else if (typeof workingAny.clone === 'function') {
        const clone = workingAny.clone();
        if (clone) {
          updateWorkingMat(clone, true);
          workingAny = workingMat as any;
        }
      }

      try {
        if (typeof workingAny.type === 'function') {
          const currentType = workingAny.type();
          if (typeof currentType === 'number' && currentType !== desiredType) {
            if (typeof workingAny.convertTo === 'function') {
              const converted = workingAny.convertTo(desiredType);
              if (converted && this.isMatLike(converted)) {
                updateWorkingMat(converted, true);
                workingAny = workingMat as any;
              }
            } else if (typeof cv.convertScaleAbs === 'function') {
              const converted = cv.convertScaleAbs(workingMat);
              if (converted && this.isMatLike(converted)) {
                updateWorkingMat(converted, true);
                workingAny = workingMat as any;
              }
            }
          }
        }
      } catch (error) {
        warnOnce('Failed to normalise CLAHE input to 8-bit', error);
      }

      let skipHistogramOps = false;
      try {
        if (typeof workingAny.type === 'function') {
          const typeCheck = workingAny.type();
          if (typeof typeCheck === 'number' && typeCheck !== desiredType) {
            warnOnce('CLAHE input not CV_8UC1; returning clone fallback');
            output = this.safeMatClone(workingMat, 'applyClahePreprocessing:typeFallback') ?? workingMat;
            skipHistogramOps = true;
          }
        }
      } catch (error) {
        warnOnce('CLAHE input type check failed', error);
      }

      if (!skipHistogramOps) {
        let claheProvider = this.claheProvider;
        if (!claheProvider) {
          this.logger.warn('CLAHE factory unavailable during preprocessing; retrying capability detection');
          const capability = this.detectClaheCapability();
          if (capability.success) {
            claheProvider = this.claheProvider;
          } else {
            this.logger.warn(
              `CLAHE detection retry failed: ${JSON.stringify(capability.errors ?? [])}`,
            );
          }
        }

        if (claheProvider) {
          try {
            const { instance, method, source } = claheProvider();
            claheInstance = instance;
            if (!claheInstance || typeof claheInstance[method] !== 'function') {
              throw new Error(`CLAHE provider ${source} returned invalid instance (method=${method})`);
            }
            const maybeOutput = claheInstance[method](workingMat);
            let resultingMat: MatLike | null = null;
            if (this.isMatLike(maybeOutput)) {
              resultingMat = maybeOutput;
            } else {
              const dest = new cv.Mat();
              const maybeVoid = claheInstance[method](workingMat, dest);
              if (this.isMatLike(maybeVoid)) {
                resultingMat = maybeVoid;
                this.releaseMat(dest);
              } else if (this.isMatLike(dest)) {
                resultingMat = dest;
              } else {
                this.releaseMat(dest);
                throw new Error(`CLAHE provider ${source} (${method}) did not produce output`);
              }
            }
            output = resultingMat;
            this.claheApplyMethod = method;
            this.logger.debug(
              `[ElementDetectorService] CLAHE applied successfully via ${source} using method '${method}'`,
            );
          } catch (error) {
            warnOnce(`CLAHE factory ${this.claheFactoryName ?? 'unknown'} failed; switching to fallback`, error);
            this.claheProvider = null;
            this.claheFactoryName = null;
            this.claheApplyMethod = null;
          }
        }

        if (!output) {
          const diagnosticsSnapshot = this.opencvCapabilities.claheDiagnostics
            ? JSON.stringify(this.opencvCapabilities.claheDiagnostics)
            : 'unknown';
          warnOnce(
            `CLAHE unavailable; using histogram fallback (diagnostics=${diagnosticsSnapshot})`,
          );
          output = this.applyHistogramFallbacks(workingMat, 'applyClahePreprocessing:fallback');
        }
      }

      if (!output) {
        throw new Error('CLAHE pipeline produced no output');
      }

      return output;
    } catch (error) {
      this.logger.error(
        'CLAHE preprocessing failed',
        (error as Error)?.stack ?? (error as Error)?.message ?? String(error),
      );
      return this.safeMatClone(mat, 'applyClahePreprocessing:error') ?? mat;
    } finally {
      // Note: CLAHE instances are garbage collected automatically in @u4/opencv4nodejs v7.1.2
      if (workingNeedsRelease && workingMat && workingMat !== output) {
        this.releaseMat(workingMat);
      }
      if (baseConversion?.needsRelease && baseConversion.mat !== output && baseConversion.mat !== workingMat) {
        this.releaseMat(baseConversion.mat);
      }
    }
  }

  private async applyDenoisePreprocessing(mat: MatLike): Promise<MatLike> {
    if (!hasCv) {
      return this.safeMatClone(mat, 'applyDenoisePreprocessing:noCv') ?? mat;
    }

    let baseConversion: MatConversion | null = null;
    let workingMat: MatLike | null = null;
    let workingNeedsRelease = false;
    let output: MatLike | null = null;

    try {
      baseConversion = this.ensureMat(mat, 'applyDenoisePreprocessing');
      workingMat = baseConversion.mat;

      const workingAny = workingMat as any;
      const channels = this.getChannelCount(workingMat);

      if (channels > 1 && typeof workingAny.cvtColor === 'function') {
        const gray = workingAny.cvtColor(cv.COLOR_BGR2GRAY ?? cv.COLOR_RGB2GRAY ?? 6);
        workingMat = gray;
        workingNeedsRelease = true;
      } else if (typeof workingAny.clone === 'function') {
        const clone = workingAny.clone();
        if (clone) {
          workingMat = clone;
          workingNeedsRelease = true;
        }
      }

      if (cv.fastNlMeansDenoising && typeof workingAny.fastNlMeansDenoising === 'function') {
        output = workingAny.fastNlMeansDenoising(10, 7, 21);
      } else if (typeof workingAny.gaussianBlur === 'function') {
        output = workingAny.gaussianBlur(new cv.Size(3, 3), 0);
      } else {
        warnOnce('No denoise kernels available; returning clone');
        output = this.safeMatClone(workingMat, 'applyDenoisePreprocessing:fallback') ?? workingMat;
      }

      if (!output) {
        throw new Error('Denoise pipeline produced no output');
      }

      return output;
    } catch (error) {
      this.logger.error(
        'Denoise preprocessing failed',
        (error as Error)?.stack ?? (error as Error)?.message ?? String(error),
      );
      return this.safeMatClone(mat, 'applyDenoisePreprocessing:error') ?? mat;
    } finally {
      if (workingNeedsRelease && workingMat && workingMat !== output) {
        this.releaseMat(workingMat);
      }
      if (baseConversion?.needsRelease && baseConversion.mat !== output && baseConversion.mat !== workingMat) {
        this.releaseMat(baseConversion.mat);
      }
    }
  }

  private applyHistogramFallbacks(mat: MatLike, context: string): MatLike {
    const attempts: Array<{
      name: string;
      action: () => MatLike | null | undefined;
    }> = [
      {
        name: 'mat.equalizeHist',
        action: () => (mat as any)?.equalizeHist?.(),
      },
      {
        name: 'cv.equalizeHist',
        action: () => (typeof (cv as any).equalizeHist === 'function' ? (cv as any).equalizeHist(mat) : null),
      },
      {
        name: 'mat.convertTo',
        action: () => (mat as any)?.convertTo?.(-1, 1.2, 12),
      },
      {
        name: 'cv.convertScaleAbs',
        action: () => (typeof cv.convertScaleAbs === 'function' ? cv.convertScaleAbs(mat, 1.2, 12) : null),
      },
      {
        name: 'gammaCorrection',
        action: () => this.applyGammaCorrection(mat, 0.9),
      },
    ];

    for (const attempt of attempts) {
      let candidate: MatLike | null | undefined;
      try {
        candidate = attempt.action();
      } catch (error) {
        warnOnce(`Histogram fallback ${attempt.name} failed`, error);
        candidate = null;
      }

      if (!candidate || !this.isMatLike(candidate)) {
        if (candidate && candidate !== mat) {
          this.releaseMat(candidate);
        }
        continue;
      }

      if (candidate !== mat) {
        warnOnce(`Using histogram fallback ${attempt.name} for ${context}`);
      }

      return candidate;
    }

    warnOnce(`All histogram fallbacks failed for ${context}; returning clone`);
    return this.safeMatClone(mat, `${context}:clone`) ?? mat;
  }

  private applyGammaCorrection(mat: MatLike, gamma: number): MatLike | null {
    if (!hasCv || typeof cv.pow !== 'function') {
      return null;
    }

    try {
      const floatType = typeof cv.CV_32F === 'number' ? cv.CV_32F : (cv as any).CV_32F ?? -1;
      const u8Type = typeof cv.CV_8UC1 === 'number' ? cv.CV_8UC1 : (cv as any).CV_8UC1 ?? -1;
      const normalized = (mat as any)?.convertTo?.(floatType, 1 / 255.0, 0);
      if (!normalized || !this.isMatLike(normalized)) {
        return null;
      }

      const gammaCorrected = cv.pow(normalized, gamma);
      if (!gammaCorrected || !this.isMatLike(gammaCorrected)) {
        this.releaseMat(normalized);
        return null;
      }

      const scaled = (gammaCorrected as any)?.convertTo?.(u8Type, 255.0, 0);
      this.releaseMat(gammaCorrected !== normalized ? gammaCorrected : null);
      this.releaseMat(normalized);

      if (!scaled || !this.isMatLike(scaled)) {
        if (scaled && scaled !== mat) {
          this.releaseMat(scaled);
        }
        return null;
      }

      return scaled;
    } catch (error) {
      warnOnce('Gamma correction fallback failed', error);
      return null;
    }
  }

  private async applyEdgePreprocessing(mat: MatLike): Promise<MatLike> {
    if (!hasCv) {
      return this.safeMatClone(mat, 'applyEdgePreprocessing:noCv') ?? mat;
    }

    let baseConversion: MatConversion | null = null;
    let workingMat: MatLike | null = null;
    let workingNeedsRelease = false;
    let edges: MatLike | null = null;
    let edgesConversion: MatConversion | null = null;
    let kernel: MatLike | null = null;
    let enhanced: MatLike | null = null;
    let returnMat: MatLike | null = null;

    try {
      baseConversion = this.ensureMat(mat, 'applyEdgePreprocessing');
      workingMat = baseConversion.mat;

      const workingAny = workingMat as any;
      const channels = this.getChannelCount(workingMat);

      if (channels > 1 && typeof workingAny.cvtColor === 'function') {
        const gray = workingAny.cvtColor(cv.COLOR_BGR2GRAY ?? cv.COLOR_RGB2GRAY ?? 6);
        workingMat = gray;
        workingNeedsRelease = true;
      } else if (typeof workingAny.clone === 'function') {
        const clone = workingAny.clone();
        if (clone) {
          workingMat = clone;
          workingNeedsRelease = true;
        }
      }

      if (typeof (workingMat as any).canny !== 'function') {
        warnOnce('Canny unavailable; returning cloned grayscale');
        const fallback = workingMat ?? baseConversion?.mat ?? mat;
        returnMat = this.safeMatClone(fallback, 'applyEdgePreprocessing:noCanny') ?? fallback;
        return returnMat;
      }

      edges = (workingMat as any).canny(50, 150);
      if (!this.isMatLike(edges)) {
        warnOnce('Canny returned non-mat output; skipping morphology stage');
        const fallback = workingMat ?? baseConversion?.mat ?? mat;
        returnMat = this.safeMatClone(fallback, 'applyEdgePreprocessing:nonMatEdges') ?? fallback;
        return returnMat;
      }

      try {
        edgesConversion = this.ensureMat(edges, 'applyEdgePreprocessing:edges');
        edges = edgesConversion.mat;
      } catch (conversionError) {
        warnOnce('Failed to normalise edge data before morphology', conversionError);
      }

      const morphRect = typeof cv.MORPH_RECT === 'number' ? cv.MORPH_RECT : 0;
      if (typeof cv.getStructuringElement === 'function' && typeof cv.Size === 'function') {
        kernel = cv.getStructuringElement(morphRect, new cv.Size(3, 3));
      }

      if (!this.isMatLike(kernel)) {
        warnOnce('Structuring element creation failed; returning raw edges');
        enhanced = edges;
        returnMat = enhanced;
        return returnMat;
      }

      const morphClose = typeof cv.MORPH_CLOSE === 'number' ? cv.MORPH_CLOSE : 3;
      
      // Use morphology provider system for consistent morphology operations
      let morphologyProvider = this.morphologyProvider;
      if (!morphologyProvider) {
        this.logger.warn('Morphology factory unavailable during edge preprocessing; retrying capability detection');
        const capability = this.detectMorphologyCapability();
        if (capability.success) {
          morphologyProvider = this.morphologyProvider;
        } else {
          this.logger.warn(
            `Morphology detection retry failed: ${JSON.stringify(capability.errors ?? [])}`,
          );
        }
      }

      if (morphologyProvider && edges && kernel) {
        try {
          const { instance, method, source } = morphologyProvider();
          if (!instance || typeof instance[method] !== 'function') {
            throw new Error(`Morphology provider ${source} returned invalid instance (method=${method})`);
          }
          
          // CRITICAL: Validate kernel is a proper Mat instance for OpenCV 4.8
          const validatedKernel = this.ensureMorphologyMat(kernel);
          if (!validatedKernel) {
            throw new Error('Kernel Mat validation failed for OpenCV 4.8 compatibility');
          }
          
          // Ensure edges Mat is also validated
          const validatedEdges = this.ensureMorphologyMat(edges);
          if (!validatedEdges) {
            throw new Error('Edges Mat validation failed for OpenCV 4.8 compatibility');
          }
          
          enhanced = instance[method](validatedEdges, morphClose, validatedKernel);
          
          // Clean up validated copies if they're different from originals
          if (validatedKernel !== kernel) {
            this.releaseMat(validatedKernel);
          }
          if (validatedEdges !== edges) {
            this.releaseMat(validatedEdges);
          }
          
          this.morphologyApplyMethod = method;
          this.logger.debug(
            `[ElementDetectorService] Morphology applied successfully via ${source} using method '${method}'`,
          );
        } catch (error) {
          warnOnce(`Morphology factory ${this.morphologyFactoryName ?? 'unknown'} failed; using fallback`, error);
          this.morphologyProvider = null;
          this.morphologyFactoryName = null;
          this.morphologyApplyMethod = null;
          enhanced = edges;
        }
      } else {
        const diagnosticsSnapshot = this.opencvCapabilities.morphologyDiagnostics
          ? JSON.stringify(this.opencvCapabilities.morphologyDiagnostics)
          : 'unknown';
        warnOnce(
          `Morphology unavailable; returning raw edges (diagnostics=${diagnosticsSnapshot})`,
        );
        enhanced = edges;
      }

      if (!enhanced) {
        enhanced = edges ?? workingMat ?? baseConversion?.mat ?? mat;
      }

      returnMat = (enhanced ?? edges ?? workingMat ?? baseConversion?.mat ?? mat) as MatLike;
      return returnMat;
    } catch (error) {
      this.logger.error(
        'Edge preprocessing failed',
        (error as Error)?.stack ?? (error as Error)?.message ?? String(error),
      );
      returnMat = this.safeMatClone(mat, 'applyEdgePreprocessing:error') ?? mat;
      return returnMat;
    } finally {
      this.releaseConversion(edgesConversion, returnMat ?? undefined);
      if (kernel) {
        this.releaseMat(kernel);
      }
      if (!edgesConversion && edges && edges !== returnMat && edges !== enhanced) {
        this.releaseMat(edges);
      }
      if (workingNeedsRelease && workingMat && workingMat !== returnMat && workingMat !== enhanced) {
        this.releaseMat(workingMat);
      }
      if (baseConversion?.needsRelease && baseConversion.mat !== returnMat && baseConversion.mat !== workingMat) {
        this.releaseMat(baseConversion.mat);
      }
    }
  }

  private async preprocessImageCanvasBuffer(
    imageBuffer: Buffer,
    method: string,
  ): Promise<Buffer> {
    try {
      const img = await loadImage(imageBuffer);
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext('2d');

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const processed = await this.preprocessImageCanvas(
        { data: new Uint8ClampedArray(imageData.data), width: imageData.width, height: imageData.height },
        method,
      );

      imageData.data.set(processed.data);
      ctx.putImageData(imageData, 0, 0);

      return canvas.toBuffer('image/png');
    } catch (error) {
      this.logger.error(
        `Canvas preprocessing failed for method ${method}`,
        (error as Error)?.stack ?? (error as Error)?.message ?? String(error),
      );
      return imageBuffer;
    }
  }

  private async preprocessImageCanvas(
    imageData: CanvasImageData,
    method: string,
  ): Promise<CanvasImageData> {
    const cloned: CanvasImageData = {
      data: new Uint8ClampedArray(imageData.data),
      width: imageData.width,
      height: imageData.height,
    };

    if (method.includes('contrast')) {
      this.enhanceContrast(cloned.data);
    }

    if (method.includes('sharpen')) {
      this.sharpenImage(cloned);
    }

    return cloned;
  }

  private enhanceContrast(data: Uint8ClampedArray): void {
    const contrast = 1.2;
    const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
      data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
      data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
    }
  }

  private sharpenImage(imageData: CanvasImageData): void {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    const kernel = [
      0, -1, 0,
      -1, 5, -1,
      0, -1, 0,
    ];

    const tempData = new Uint8ClampedArray(data);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4 + c;
              sum += tempData[idx] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const idx = (y * width + x) * 4 + c;
          data[idx] = Math.min(255, Math.max(0, sum));
        }
      }
    }
  }

  private ensureGrayscale(mat: MatLike): MatLike {
    if (!hasCv) {
      return mat;
    }
    try {
      const clone = this.safeClone(mat) ?? mat;
      const cloneAny = clone as any;
      const channelCount =
        typeof cloneAny.channels === 'function'
          ? cloneAny.channels()
          : cloneAny.channels ?? 0;

      if (channelCount && channelCount > 1) {
        return this.toGray(clone);
      }

      if (typeof cloneAny.clone === 'function') {
        return cloneAny.clone();
      }

      return clone;
    } catch (error) {
      warnOnce('ensureGrayscale failed', error);
      return mat;
    }
  }

  private wordsToElements(
    words: Array<{ text: string; confidence?: number; bbox: { x0: number; y0: number; x1: number; y1: number } }>,
    offsetX: number,
    offsetY: number,
    scale: number,
    strategyName: string,
  ): DetectedElement[] {
    const elements: DetectedElement[] = [];

    for (const word of words) {
      const confidence = Math.max(0, Math.min((word.confidence ?? 0) / 100, 1));
      if (confidence === 0) {
        continue;
      }

      const rawText = (word.text || '').replace(/\s+/g, ' ').trim();
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
        confidence,
        text: rawText,
        description: `Text element: "${rawText}"`,
        metadata: {
          detectionMethod: 'ocr',
          ocrConfidence: word.confidence ?? confidence * 100,
          ocrAttempt: strategyName,
        },
      });
    }

    return elements;
  }

  private inferElementType(text: string, width: number, height: number): ElementType {
    const lowerText = text.toLowerCase();
    const buttonKeywords = ['install', 'save', 'cancel', 'ok', 'submit', 'login', 'sign in', 'download'];

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

  private async toUniversalElement(
    element: DetectedElement,
    searchRegion?: BoundingBox,
  ): Promise<UniversalUIElement | null> {
    const type = this.mapToUniversalType(element, searchRegion);
    if (!type) {
      return null;
    }

    const clickTarget = await this.getClickCoordinates(element);
    const semanticRole = this.inferSemanticRole(element.text, type);
    const description = this.buildUniversalDescription(
      element,
      type,
      clickTarget.coordinates,
      searchRegion,
      semanticRole,
    );

    return {
      id: element.id,
      type,
      bounds: {
        x: element.coordinates.x,
        y: element.coordinates.y,
        width: element.coordinates.width,
        height: element.coordinates.height,
      },
      clickPoint: clickTarget.coordinates,
      confidence: Number(element.confidence.toFixed(3)),
      text: element.text?.trim() || undefined,
      semanticRole,
      description,
    };
  }

  private mapToUniversalType(
    element: DetectedElement,
    searchRegion?: BoundingBox,
  ): UniversalElementType | null {
    const { width, height } = element.coordinates;

    if (width < MIN_INTERACTIVE_WIDTH || height < MIN_INTERACTIVE_HEIGHT) {
      return null;
    }

    switch (element.type) {
      case 'button':
        return 'button';
      case 'input':
        return 'text_input';
      case 'dropdown':
      case 'link':
      case 'icon':
      case 'checkbox':
        return 'clickable';
      default:
        break;
    }

    if (this.looksLikeMenuItem(element, searchRegion)) {
      return 'menu_item';
    }

    if (this.looksInteractiveText(element)) {
      return 'clickable';
    }

    if (element.type === 'unknown' && element.metadata.detectionMethod === 'edge') {
      return 'clickable';
    }

    return null;
  }

  private looksLikeMenuItem(element: DetectedElement, searchRegion?: BoundingBox): boolean {
    if (!element.text) {
      return false;
    }

    const label = element.text.trim();
    if (!label || label.length > 18) {
      return false;
    }

    const lower = label.toLowerCase();
    const menuKeywords = ['file', 'edit', 'view', 'help', 'window', 'go', 'tools', 'settings'];
    if (!menuKeywords.includes(lower)) {
      return false;
    }

    const regionTop = searchRegion?.y ?? 0;
    const regionHeight = searchRegion?.height ?? DEFAULT_SCREEN_HEIGHT;
    const relativeTop = element.coordinates.y - regionTop;

    if (relativeTop > Math.min(regionHeight * 0.25, 160)) {
      return false;
    }

    return element.coordinates.height >= 18 && element.coordinates.height <= 40;
  }

  private looksInteractiveText(element: DetectedElement): boolean {
    if (!element.text) {
      return false;
    }

    const label = element.text.trim();
    if (!label) {
      return false;
    }

    const lower = label.toLowerCase();
    const interactiveKeywords = [
      'ok',
      'close',
      'cancel',
      'next',
      'previous',
      'back',
      'finish',
      'done',
      'allow',
      'deny',
      'retry',
      'update',
      'install',
      'open',
      'continue',
      'submit',
      'send',
      'apply',
      'yes',
      'no',
    ];

    if (
      interactiveKeywords.some(
        (keyword) =>
          lower === keyword ||
          lower.startsWith(`${keyword} `) ||
          lower.endsWith(` ${keyword}`),
      )
    ) {
      return true;
    }

    if (label.length > 22) {
      return false;
    }

    const words = label.split(/\s+/);
    if (words.length > 3) {
      return false;
    }

    const { width, height } = element.coordinates;
    const aspectRatio = width / Math.max(height, 1);

    if (height < 18 || height > 68) {
      return false;
    }

    if (aspectRatio < 1.2 || aspectRatio > 6.5) {
      return false;
    }

    if (/^[A-Z]/.test(label)) {
      return true;
    }

    const alphaCharacters = label.replace(/[^A-Za-z]/g, '');
    if (!alphaCharacters) {
      return false;
    }

    const uppercaseRatio = label.replace(/[^A-Z]/g, '').length / alphaCharacters.length;
    return uppercaseRatio > 0.5;
  }

  private inferSemanticRole(
    text: string | undefined,
    type: UniversalElementType,
  ): string | undefined {
    if (!text) {
      return undefined;
    }

    const value = text.trim().toLowerCase();
    if (!value) {
      return undefined;
    }

    const roleMatchers: Array<{ role: string; patterns: RegExp[] }> = [
      { role: 'submit', patterns: [/submit/, /apply/, /send/, /confirm/, /ok\b/, /\bgo\b/, /start/] },
      { role: 'cancel', patterns: [/cancel/, /close/, /dismiss/, /abort/] },
      { role: 'search', patterns: [/search/, /find/, /lookup/] },
      { role: 'login', patterns: [/log ?in/, /sign ?in/] },
      { role: 'signup', patterns: [/sign ?up/, /register/, /create account/] },
      { role: 'next', patterns: [/next/, /continue/, /forward/] },
      { role: 'back', patterns: [/back/, /previous/, /return/] },
      { role: 'delete', patterns: [/delete/, /remove/, /trash/] },
      { role: 'save', patterns: [/save/, /store/] },
      { role: 'edit', patterns: [/edit/, /modify/] },
    ];

    for (const matcher of roleMatchers) {
      if (matcher.patterns.some((pattern) => pattern.test(value))) {
        return matcher.role;
      }
    }

    if (type === 'text_input') {
      if (value.includes('search')) {
        return 'search';
      }
      if (value.includes('password')) {
        return 'password';
      }
      if (value.includes('email')) {
        return 'email';
      }
    }

    return undefined;
  }

  private buildUniversalDescription(
    element: DetectedElement,
    type: UniversalElementType,
    clickPoint: { x: number; y: number },
    searchRegion?: BoundingBox,
    semanticRole?: string,
  ): string {
    const typeLabel = this.formatTypeWithRole(type, semanticRole);
    const trimmedText = element.text?.trim();
    const textFragment = trimmedText ? `"${trimmedText}"` : 'with no visible text';
    const locationFragment = this.describeLocation(element.coordinates, searchRegion);

    return `${typeLabel} ${textFragment} ${locationFragment} at (${clickPoint.x}, ${clickPoint.y})`;
  }

  private formatTypeWithRole(type: UniversalElementType, semanticRole?: string): string {
    const base = this.describeType(type);
    if (!semanticRole) {
      return this.capitalizeFirst(base);
    }
    return `${this.capitalizeFirst(semanticRole)} ${base}`;
  }

  private describeType(type: UniversalElementType): string {
    switch (type) {
      case 'button':
        return 'button';
      case 'text_input':
        return 'text input';
      case 'menu_item':
        return 'menu item';
      case 'clickable':
      default:
        return 'clickable control';
    }
  }

  private describeLocation(bounds: BoundingBox, searchRegion?: BoundingBox): string {
    const originX = searchRegion?.x ?? 0;
    const originY = searchRegion?.y ?? 0;
    const regionWidth = Math.max(searchRegion?.width ?? DEFAULT_SCREEN_WIDTH, 1);
    const regionHeight = Math.max(searchRegion?.height ?? DEFAULT_SCREEN_HEIGHT, 1);

    const relativeX = bounds.centerX - originX;
    const relativeY = bounds.centerY - originY;

    const horizontalBand =
      relativeX < regionWidth / 3
        ? 'left'
        : relativeX > (regionWidth * 2) / 3
        ? 'right'
        : 'center';
    const verticalBand =
      relativeY < regionHeight / 3
        ? 'top'
        : relativeY > (regionHeight * 2) / 3
        ? 'bottom'
        : 'middle';

    if (horizontalBand === 'center' && verticalBand === 'middle') {
      return 'near center';
    }

    if (horizontalBand === 'center') {
      return `toward ${verticalBand}`;
    }

    if (verticalBand === 'middle') {
      return `along ${horizontalBand}`;
    }

    return `near ${verticalBand}-${horizontalBand}`;
  }

  private resolveUniversalDetectionMethod(
    elements: DetectedElement[],
  ): UniversalDetectionMethod {
    if (elements.length === 0) {
      return 'visual';
    }

    const methods = new Set(elements.map((element) => element.metadata.detectionMethod));
    const hasText = methods.has('ocr');
    const hasVisual = methods.has('edge') || methods.has('template');
    const hasHybrid = methods.has('hybrid');

    if ((hasText && hasVisual) || hasHybrid) {
      return 'hybrid';
    }

    if (hasText) {
      return 'text';
    }

    return 'visual';
  }

  private capitalizeFirst(value: string): string {
    if (!value) {
      return value;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private getNow(): number {
    if (typeof performance?.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  private calculateDescriptionMatch(element: DetectedElement, description: string): number {
    const desc = description.toLowerCase();
    let score = 0;

    if (element.text) {
      const elementText = element.text.toLowerCase();
      if (elementText.includes(desc) || desc.includes(elementText)) {
        score += 0.8;
      } else {
        score += this.fuzzyMatch(elementText, desc) * 0.6;
      }
    }

    if (desc.includes('button') && element.type === 'button') score += 0.3;
    if (desc.includes('field') && element.type === 'input') score += 0.3;
    if (desc.includes('link') && element.type === 'link') score += 0.3;

    score *= element.confidence;

    return Math.min(score, 1.0);
  }

  private mergeOverlappingElements(elements: DetectedElement[]): DetectedElement[] {
    const merged: DetectedElement[] = [];

    for (const element of elements) {
      const overlapping = merged.find(
        (candidate) => this.calculateOverlap(candidate.coordinates, element.coordinates) > 0.7,
      );

      if (overlapping) {
        if (element.confidence > overlapping.confidence) {
          const index = merged.indexOf(overlapping);
          merged[index] = element;
        }
      } else {
        merged.push(element);
      }
    }

    return merged;
  }

  private calculateOverlap(box1: BoundingBox, box2: BoundingBox): number {
    const xOverlap = Math.max(0, Math.min(box1.x + box1.width, box2.x + box2.width) - Math.max(box1.x, box2.x));
    const yOverlap = Math.max(0, Math.min(box1.y + box1.height, box2.y + box2.height) - Math.max(box1.y, box2.y));
    const overlapArea = xOverlap * yOverlap;
    const totalArea = box1.width * box1.height + box2.width * box2.height - overlapArea;

    if (totalArea === 0) {
      return 0;
    }

    return overlapArea / totalArea;
  }

  private fuzzyMatch(text1: string, text2: string): number {
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  private getDefaultConfig(): DetectionConfig {
    return {
      enableOCR: true,
      enableTemplateMatching: true,
      enableEdgeDetection: true,
      confidenceThreshold: 0.5,
    };
  }

  private async getWorker(): Promise<Worker | null> {
    if (this.worker) {
      return this.worker;
    }

    if (!this.workerPromise) {
      this.workerPromise = this.createWorker();
    }

    try {
      this.worker = await this.workerPromise;
    } catch (error) {
      warnOnce('Failed to initialise Tesseract worker', error);
      this.worker = null;
      this.workerPromise = null;
    }

    return this.worker;
  }

  private async createWorker(): Promise<Worker> {
    return createWorker();
  }

  private async getTemplateDetector() {
    if (this.templateDetectorLoaded) {
      return this.templateDetector;
    }
    this.templateDetectorLoaded = true;

    if (!hasCv) {
      this.templateDetector = null;
      return this.templateDetector;
    }

    try {
      const module: TemplateDetectorModule = await import('../detectors/template/template-detector');
      this.templateDetector = new module.TemplateDetector();
    } catch (error) {
      warnOnce('Template detector unavailable', error);
      this.templateDetector = null;
    }
    return this.templateDetector;
  }

  private async getEdgeDetector() {
    if (this.edgeDetectorLoaded) {
      return this.edgeDetector;
    }
    this.edgeDetectorLoaded = true;

    if (!hasCv) {
      this.edgeDetector = null;
      return this.edgeDetector;
    }

    try {
      const module: EdgeDetectorModule = await import('../detectors/edge/edge-detector');
      this.edgeDetector = new module.EdgeDetector();
    } catch (error) {
      warnOnce('Edge detector unavailable', error);
      this.edgeDetector = null;
    }
    return this.edgeDetector;
  }
}
