type CvModule = Record<string, any>;

type LoadState = {
  module: CvModule | null;
  errorMessage: string | null;
};

type WarnTarget = Pick<Console, 'warn'> | { warn: (...args: any[]) => unknown };

// Declare require function for environments where it's not automatically available
declare const require: (id: string) => any;

// Declare process for Node.js environment
declare const process: {
  env: Record<string, string | undefined>;
};

let cachedState: LoadState | null = null;
const warnedContexts = new Set<string>();

function applyOpenCvPolyfills(cv: CvModule | null): void {
  if (!cv) {
    return;
  }

  // Apply CLAHE polyfill
  applyClahePolyfill(cv);
  
  // Apply Scalar polyfill for OpenCV 4.8 compatibility
  applyScalarPolyfill(cv);
  
  // Apply morphology polyfills
  applyMorphologyPolyfills(cv);
  
  // Apply Mat construction polyfills
  applyMatPolyfills(cv);
}

function applyClahePolyfill(cv: CvModule | null): void {
  if (!cv) {
    return;
  }

  const claheCtor = (cv as any).CLAHE;
  if (typeof claheCtor !== 'function') {
    return;
  }

  const ensureFactory = (target: Record<string, any>) => {
    if (typeof target.createCLAHE !== 'function') {
      target.createCLAHE = (...args: any[]) => new claheCtor(...args);
    }
  };

  ensureFactory(cv as Record<string, any>);

  if (!(cv as any).imgproc) {
    (cv as any).imgproc = {};
  }
  ensureFactory((cv as any).imgproc);

  if (!(cv as any).xphoto) {
    (cv as any).xphoto = {};
  }
  ensureFactory((cv as any).xphoto);

  if (!(cv as any).ximgproc) {
    (cv as any).ximgproc = {};
  }
  ensureFactory((cv as any).ximgproc);
}

function applyScalarPolyfill(cv: CvModule | null): void {
  if (!cv) {
    return;
  }

  // Enhanced Scalar polyfill for OpenCV 4.8 compatibility
  const createScalarPolyfill = (val0: number, val1?: number, val2?: number, val3?: number) => {
    const values = [val0 ?? 0, val1 ?? 0, val2 ?? 0, val3 ?? 0];
    
    // Try native Scalar methods first
    if (typeof (cv as any).scalar === 'function') {
      try {
        return (cv as any).scalar(...values);
      } catch (error) {
        // Continue to fallback methods
      }
    }
    
    if (typeof (cv as any).Vec4d === 'function') {
      try {
        return new (cv as any).Vec4d(...values);
      } catch (error) {
        // Continue to fallback methods  
      }
    }
    
    // Enhanced fallback with OpenCV 4.8 compatible interface
    const scalarObj: any = {
      val: values,
      isScalar: true,
      length: 4,
      // Add array-like access
      0: values[0],
      1: values[1], 
      2: values[2],
      3: values[3],
      // OpenCV 4.8 compatibility methods
      at: (index: number) => values[index] ?? 0,
      get: (index: number) => values[index] ?? 0,
      set: (index: number, value: number) => { 
        values[index] = value; 
        if (index >= 0 && index <= 3) {
          scalarObj[index] = value;
        }
      },
      clone: () => createScalarPolyfill(values[0], values[1], values[2], values[3]),
      toString: () => `Scalar(${values.join(', ')})`,
      // Add iteration support
      [Symbol.iterator]: function* () {
        for (let i = 0; i < 4; i++) {
          yield values[i];
        }
      }
    };
    
    return scalarObj;
  };

  // Apply Scalar polyfill if missing or broken
  if (typeof (cv as any).Scalar !== 'function') {
    (cv as any).Scalar = createScalarPolyfill;
  } else {
    // Test existing Scalar and wrap if problematic
    try {
      const testScalar = new (cv as any).Scalar(128);
      if (!testScalar || typeof testScalar !== 'object') {
        (cv as any).Scalar = createScalarPolyfill;
      }
    } catch (error) {
      (cv as any).Scalar = createScalarPolyfill;
    }
  }
    
  // Also add scalar as lowercase function
  if (typeof (cv as any).scalar !== 'function') {
    (cv as any).scalar = (cv as any).Scalar;
  }
}

function applyMorphologyPolyfills(cv: CvModule | null): void {
  if (!cv) {
    return;
  }

  // Ensure morphology constants are available
  const morphConstants = {
    MORPH_RECT: 0,
    MORPH_CROSS: 1, 
    MORPH_ELLIPSE: 2,
    MORPH_ERODE: 0,
    MORPH_DILATE: 1,
    MORPH_OPEN: 2,
    MORPH_CLOSE: 3,
    MORPH_GRADIENT: 4,
    MORPH_TOPHAT: 5,
    MORPH_BLACKHAT: 6
  };

  // Add missing morphology constants
  Object.entries(morphConstants).forEach(([key, value]) => {
    if (typeof (cv as any)[key] !== 'number') {
      (cv as any)[key] = value;
    }
  });

  // Ensure getStructuringElement is available
  if (typeof cv.getStructuringElement !== 'function' && typeof (cv as any).imgproc?.getStructuringElement === 'function') {
    cv.getStructuringElement = (cv as any).imgproc.getStructuringElement;
  }
}

function applyMatPolyfills(cv: CvModule | null): void {
  if (!cv) {
    return;
  }

  // Ensure CV type constants are available
  const cvTypes = {
    CV_8UC1: 0,
    CV_8UC2: 8,
    CV_8UC3: 16,
    CV_8UC4: 24,
    CV_32F: 5,
    CV_32FC1: 5,
    CV_32FC3: 21
  };

  Object.entries(cvTypes).forEach(([key, value]) => {
    if (typeof (cv as any)[key] !== 'number') {
      (cv as any)[key] = value;
    }
  });

  // Enhance Mat constructor with better error handling
  if (typeof cv.Mat === 'function') {
    const originalMat = cv.Mat;
    cv.Mat = function(...args: any[]) {
      try {
        return new originalMat(...args);
      } catch (error) {
        // Enhanced error context for debugging
        const errorMsg = `Mat construction failed with args: ${JSON.stringify(args)} - ${(error as Error).message}`;
        throw new Error(errorMsg);
      }
    };
    
    // Preserve prototype and static methods
    cv.Mat.prototype = originalMat.prototype;
    Object.setPrototypeOf(cv.Mat, originalMat);
    Object.getOwnPropertyNames(originalMat).forEach(prop => {
      if (prop !== 'prototype' && prop !== 'name' && prop !== 'length') {
        try {
          cv.Mat[prop] = originalMat[prop];
        } catch {
          // Ignore descriptor errors
        }
      }
    });

    // Add Mat.type() polyfill if missing (common in opencv4nodejs v6.3.0 with OpenCV 4.6.0)
    if (cv.Mat.prototype && typeof cv.Mat.prototype.type !== 'function') {
      cv.Mat.prototype.type = function() {
        // Try to determine type from channels and depth
        try {
          const channels = typeof this.channels === 'function' ? this.channels() : 
                          typeof this.channels === 'number' ? this.channels : 1;
          
          // Default to appropriate type based on channels
          switch (channels) {
            case 1: return (cv as any).CV_8UC1 ?? 0;
            case 2: return (cv as any).CV_8UC2 ?? 8;
            case 3: return (cv as any).CV_8UC3 ?? 16;
            case 4: return (cv as any).CV_8UC4 ?? 24;
            default: return (cv as any).CV_8UC1 ?? 0;
          }
        } catch {
          // Fallback to grayscale type
          return (cv as any).CV_8UC1 ?? 0;
        }
      };
    }
  }
}

function ensureState(): LoadState {
  if (cachedState) {
    return cachedState;
  }

  let lastError: unknown = null;
  
  try {
    // Try the standardized @u4/opencv4nodejs package
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const module = require('@u4/opencv4nodejs') as CvModule;
    if (module) {
      applyOpenCvPolyfills(module);
      cachedState = { module, errorMessage: null };
      return cachedState;
    }
  } catch (error) {
    lastError = error;
  }

  // If we get here, loading failed
  cachedState = { module: null, errorMessage: formatLoadError(lastError) };
  return cachedState;
}

export function getOpenCvModule(): CvModule | null {
  return ensureState().module;
}

export function hasOpenCv(): boolean {
  return ensureState().module !== null;
}

export function getOpenCvErrorMessage(): string | null {
  return ensureState().errorMessage;
}

export function refreshOpenCvModule(): CvModule | null {
  cachedState = null;
  return getOpenCvModule();
}

export function logOpenCvWarning(
  context: string,
  target: WarnTarget = console,
): void {
  const state = ensureState();

  if (state.module || !state.errorMessage || warnedContexts.has(context)) {
    return;
  }

  warnedContexts.add(context);
  const message = `[${context}] ${state.errorMessage}`;

  if (typeof (target as Console).warn === 'function') {
    (target as Console).warn(message);
    return;
  }

  if (typeof (target as { warn?: (...args: any[]) => unknown }).warn === 'function') {
    (target as { warn?: (...args: any[]) => unknown }).warn!(message);
  }
}

function formatLoadError(error: unknown): string {
  const unavailableMessage =
    'OpenCV native bindings (opencv4nodejs) unavailable; vision features will degrade.';

  if (!error) {
    return unavailableMessage;
  }

  if (typeof error === 'string') {
    return `${unavailableMessage} ${stripRequireStack(error)}`.trim();
  }

  const err = error as { code?: string; message?: string };

  if (err.code === 'MODULE_NOT_FOUND') {
    return `${unavailableMessage} Module not found in the current runtime.`;
  }

  const detail = stripRequireStack(err.message ?? String(error));
  const codeSuffix = err.code ? ` (${err.code})` : '';

  if (!detail) {
    return `${unavailableMessage}${codeSuffix}`.trim();
  }

  return `Failed to initialise OpenCV native bindings${codeSuffix}: ${detail}`;
}

function stripRequireStack(message: string): string {
  if (!message) {
    return '';
  }

  const [firstLine] = message.split('\n');
  return firstLine?.trim() ?? '';
}
