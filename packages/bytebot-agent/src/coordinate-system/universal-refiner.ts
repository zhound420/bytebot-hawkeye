import { ClickContext } from '@bytebot/shared';
import {
  Coordinates,
  ScreenshotCustomRegionOptions,
  ScreenshotFnOptions,
  ScreenshotResponse,
  SmartClickAI,
} from '../agent/smart-click.types';
import { Calibrator } from './calibrator';
import { CoordinateTeacher } from './coordinate-teacher';
import {
  CoordinateParser,
  ParsedCoordinateResponse,
  evaluateCoordinateSuspicion,
} from './coordinate-parser';

export interface UniversalCoordinateStep {
  id: string;
  label: string;
  prompt: string;
  response: ParsedCoordinateResponse;
  raw: string;
  screenshot: ScreenshotResponse;
}

export interface UniversalCoordinateResult {
  coordinates: Coordinates;
  baseCoordinates: Coordinates;
  context: Omit<ClickContext, 'targetDescription' | 'source' | 'clickTaskId'>;
  steps: UniversalCoordinateStep[];
  appliedOffset: Coordinates | null;
  calibrationHistory: ReturnType<Calibrator['getHistory']>;
  confidence: number | null;
  reasoning: string | null;
}

export interface UniversalRefinerOptions {
  gridSizeHint?: number;
  progress?: {
    taskId?: string;
    fullStep?: { step: number; message: string };
    zoomStep?: { step: number; message: string };
  };
}

interface Dimension {
  width: number;
  height: number;
}

export class UniversalCoordinateRefiner {
  constructor(
    private readonly ai: SmartClickAI,
    private readonly teacher: CoordinateTeacher,
    private readonly parser: CoordinateParser,
    private readonly calibrator: Calibrator,
    private readonly capture: {
      full: (options: ScreenshotFnOptions) => Promise<ScreenshotResponse>;
      zoom: (
        options: ScreenshotCustomRegionOptions,
      ) => Promise<ScreenshotResponse>;
    },
  ) {}

  async locate(
    targetDescription: string,
    options: UniversalRefinerOptions = {},
  ): Promise<UniversalCoordinateResult> {
    const steps: UniversalCoordinateStep[] = [];
    const gridSize = options.gridSizeHint ?? 100;

    const fullScreenshot = await this.capture.full({
      gridOverlay: true,
      gridSize,
      highlightRegions: true,
      showCursor: true,
      progressStep: options.progress?.fullStep?.step,
      progressMessage: options.progress?.fullStep?.message,
      progressTaskId: options.progress?.taskId,
    });

    this.calibrator.captureOffset(fullScreenshot.offset);
    const dimensions = this.getDimensions(fullScreenshot.image);

    const fullPrompt = this.teacher.buildFullFramePrompt({
      targetDescription,
      offsetHint: this.calibrator.getCurrentOffset(),
      samplePoint: { x: 100, y: 100 },
    });

    const fullRaw = await this.ai.askAboutScreenshot(
      fullScreenshot.image,
      fullPrompt,
    );
    const fullParsed = this.parser.parse(fullRaw);
    const suspicion = evaluateCoordinateSuspicion(fullParsed, {
      dimensions: dimensions ?? undefined,
    });

    if (suspicion.suspicious) {
      fullParsed.needsZoom = true;
      const suspicionNote = `Zoom recommended: ${suspicion.reasons.join(' ')}`;
      fullParsed.reasoning = fullParsed.reasoning
        ? `${fullParsed.reasoning} ${suspicionNote}`
        : suspicionNote;
    }

    steps.push({
      id: 'full-frame',
      label: 'Full frame analysis',
      prompt: fullPrompt,
      response: fullParsed,
      raw: fullRaw,
      screenshot: fullScreenshot,
    });

    let bestGlobal = fullParsed.global ?? null;
    let needsZoom = fullParsed.needsZoom ?? !bestGlobal;
    if (suspicion.suspicious) {
      needsZoom = true;
    }

    let zoomStep: UniversalCoordinateStep | null = null;

    if (needsZoom || !bestGlobal) {
      const zoomRegion = this.resolveZoomRegion(fullParsed, dimensions);

      const zoomScreenshot = await this.capture.zoom({
        ...zoomRegion,
        gridSize: Math.max(20, Math.round(gridSize / 2)),
        zoomLevel: 2,
        showCursor: true,
        progressStep: options.progress?.zoomStep?.step,
        progressMessage: options.progress?.zoomStep?.message,
        progressTaskId: options.progress?.taskId,
      });

      this.calibrator.captureOffset(zoomScreenshot.offset);

      const zoomPrompt = this.teacher.buildZoomPrompt({
        targetDescription,
        region: zoomRegion,
        zoomLevel: zoomScreenshot.zoomLevel ?? 2,
        offsetHint: this.calibrator.getCurrentOffset(),
        fallbackGlobal: bestGlobal ?? undefined,
      });

      const zoomRaw = await this.ai.askAboutScreenshot(
        zoomScreenshot.image,
        zoomPrompt,
      );
      const zoomParsed = this.parser.parse(zoomRaw);

      zoomStep = {
        id: 'zoom-refine',
        label: 'Zoom refinement',
        prompt: zoomPrompt,
        response: zoomParsed,
        raw: zoomRaw,
        screenshot: zoomScreenshot,
      };
      steps.push(zoomStep);

      if (zoomParsed.global) {
        bestGlobal = zoomParsed.global;
        needsZoom = false;
      } else if (zoomParsed.local) {
        const anchor = this.resolveZoomAnchor(zoomScreenshot, zoomRegion);
        bestGlobal = {
          x: Math.round(anchor.x + zoomParsed.local.x),
          y: Math.round(anchor.y + zoomParsed.local.y),
        };
        needsZoom = false;
      }
    }

    if (!bestGlobal) {
      throw new Error(
        'Universal coordinate refiner could not obtain global coordinates.',
      );
    }

    const appliedOffset = this.calibrator.getCurrentOffset();
    const adjusted = this.calibrator.apply(bestGlobal);

    const context: UniversalCoordinateResult['context'] = {
      region: zoomStep?.screenshot.region ?? undefined,
      zoomLevel: zoomStep?.screenshot.zoomLevel ?? 1,
    };

    return {
      coordinates: adjusted,
      baseCoordinates: bestGlobal,
      context,
      steps,
      appliedOffset,
      calibrationHistory: this.calibrator.getHistory(),
      confidence:
        zoomStep?.response.confidence ?? steps[0]?.response.confidence ?? null,
      reasoning:
        zoomStep?.response.reasoning ?? steps[0]?.response.reasoning ?? null,
    };
  }

  private resolveZoomRegion(
    parsed: ParsedCoordinateResponse,
    dims: Dimension | null,
  ): { x: number; y: number; width: number; height: number } {
    const fallbackWidth = dims
      ? Math.max(280, Math.round(dims.width / 3))
      : 400;
    const fallbackHeight = dims
      ? Math.max(220, Math.round(dims.height / 3))
      : 300;

    const zoom = parsed.zoom;
    const center =
      zoom?.center ??
      parsed.global ??
      (dims ? { x: dims.width / 2, y: dims.height / 2 } : { x: 960, y: 540 });

    const width = zoom?.region?.width ?? fallbackWidth;
    const height = zoom?.region?.height ?? fallbackHeight;

    const rect = {
      x: Math.max(0, Math.round(center.x - width / 2)),
      y: Math.max(0, Math.round(center.y - height / 2)),
      width: Math.round(width),
      height: Math.round(height),
    };

    if (dims) {
      rect.x = Math.min(rect.x, Math.max(0, dims.width - rect.width));
      rect.y = Math.min(rect.y, Math.max(0, dims.height - rect.height));
    }

    return rect;
  }

  private resolveZoomAnchor(
    screenshot: ScreenshotResponse,
    requested: { x: number; y: number; width: number; height: number },
  ): Coordinates {
    if (screenshot.offset) {
      return screenshot.offset;
    }
    if (screenshot.region) {
      return { x: screenshot.region.x, y: screenshot.region.y };
    }
    return { x: requested.x, y: requested.y };
  }

  private getDimensions(image: string): Dimension | null {
    try {
      const buf = Buffer.from(image, 'base64');
      if (buf.length < 24) {
        return null;
      }
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (!Number.isFinite(width) || !Number.isFinite(height)) {
        return null;
      }
      return { width, height };
    } catch {
      return null;
    }
  }
}
