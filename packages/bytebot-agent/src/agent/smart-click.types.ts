import { ClickContext } from '@bytebot/shared';

export interface Coordinates {
  x: number;
  y: number;
}

export interface SmartClickAI {
  askAboutScreenshot(image: string, prompt: string): Promise<string>;
  getCoordinates(
    image: string,
    prompt: string,
  ): Promise<{ x: number; y: number }>;
}

export interface ScreenshotResponse {
  image: string;
  offset?: Coordinates | null;
  region?: { x: number; y: number; width: number; height: number } | null;
  zoomLevel?: number | null;
}

export interface ScreenshotFnOptions {
  gridOverlay?: boolean;
  gridSize?: number;
  highlightRegions?: boolean;
  showCursor?: boolean;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  markTarget?: {
    coordinates: Coordinates;
    label?: string;
  };
}

export interface ScreenshotRegionOptions {
  region: string;
  gridSize?: number;
  enhance?: boolean;
  includeOffset?: boolean;
  addHighlight?: boolean;
  showCursor?: boolean;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  zoomLevel?: number;
}

export interface ScreenshotCustomRegionOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  gridSize?: number;
  zoomLevel?: number;
  showCursor?: boolean;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
}

export interface ScreenshotTargetOptions {
  coordinates: Coordinates;
  label?: string;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  showCursor?: boolean;
}

export interface SmartClickResult {
  coordinates: Coordinates;
  context: ClickContext;
}
