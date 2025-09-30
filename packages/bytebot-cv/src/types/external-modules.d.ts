declare module '@u4/opencv4nodejs' {
  type BoundingFunction = { boundingRect(): Rect };

  interface MatInstance {
    cols: number;
    rows: number;
    cvtColor(code: number): MatInstance;
    gaussianBlur(size: Size, sigma: number): MatInstance;
    canny(threshold1: number, threshold2: number): MatInstance;
    findContours(mode: number, method: number): BoundingFunction[];
    matchTemplate(mat: MatInstance, method: number): {
      minMaxLoc(): { maxLoc: { x: number; y: number }; maxVal: number };
    };
    minMaxLoc(): { maxLoc: { x: number; y: number }; maxVal: number };
    getRegion(rect: Rect): MatInstance;
  }

  interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  interface Size {
    width: number;
    height: number;
  }

  interface OpenCV {
    Mat: { new (...args: any[]): MatInstance };
    Rect: { new (x: number, y: number, width: number, height: number): Rect };
    Size: { new (width: number, height: number): Size };
    imdecode(buffer: Buffer): MatInstance;
    imread(path: string): MatInstance;
    COLOR_BGR2GRAY: number;
    RETR_EXTERNAL: number;
    CHAIN_APPROX_SIMPLE: number;
    TM_CCOEFF_NORMED: number;
  }

  const cv: OpenCV;
  export = cv;
}

declare module 'tesseract.js' {
  export interface Word {
    text: string;
    confidence?: number;
    bbox: { x0: number; x1: number; y0: number; y1: number };
  }

  export interface RecognizeResult {
    data: {
      text: string;
      confidence: number;
      words?: Word[];
    };
  }

  export interface Worker {
    load(): Promise<void>;
    loadLanguage(lang: string): Promise<void>;
    initialize(lang: string): Promise<void>;
    recognize(image: Buffer | string, options?: Record<string, unknown>): Promise<RecognizeResult>;
    terminate(): Promise<void>;
  }

  export function createWorker(options?: Record<string, unknown>): Promise<Worker>;
}
