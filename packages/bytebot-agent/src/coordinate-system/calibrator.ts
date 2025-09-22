import { Coordinates } from '../agent/smart-click.types';

export interface CalibrationSample {
  offset: Coordinates;
  predicted: Coordinates | null;
  actual: Coordinates | null;
  success: boolean | null;
  targetDescription: string | null;
  error: number | null;
  timestamp: number;
  source: string;
}

export interface CalibrationSampleMetadata {
  predicted?: Coordinates | null;
  actual?: Coordinates | null;
  success?: boolean | null;
  targetDescription?: string | null;
  error?: number | null;
}

export type RecordCorrectionOptions =
  | string
  | (CalibrationSampleMetadata & { source?: string });

export interface CalibrationTelemetrySample {
  offset: Coordinates;
  source: string;
  timestamp: number;
  metadata: CalibrationSampleMetadata;
}

type CanvasContextLike = {
  canvas?: { width: number; height: number } | null;
  save?: () => void;
  restore?: () => void;
  fillRect: (x: number, y: number, width: number, height: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  measureText?: (text: string) => { width: number };
  font?: string;
  textBaseline?: string;
  fillStyle?: string;
  globalAlpha?: number;
};

export class Calibrator {
  private readonly samples: CalibrationSample[] = [];
  private readonly telemetry: CalibrationTelemetrySample[] = [];
  private readonly maxHistory: number;

  constructor(maxHistory = 50) {
    this.maxHistory = Math.max(maxHistory, 50);
  }

  captureOffset(
    offset?: Coordinates | null,
    source = 'screenshot',
    metadata: CalibrationSampleMetadata = {},
  ): void {
    if (!offset) {
      return;
    }

    const normalized = this.normalize(offset);
    const success = metadata.success === undefined ? null : metadata.success;
    const error =
      metadata.error === undefined
        ? this.calculateError(normalized)
        : metadata.error;
    this.samples.push({
      offset: normalized,
      predicted: metadata.predicted ?? null,
      actual: metadata.actual ?? null,
      success,
      targetDescription: metadata.targetDescription ?? null,
      error,
      timestamp: Date.now(),
      source,
    });

    if (this.samples.length > this.maxHistory) {
      this.samples.splice(0, this.samples.length - this.maxHistory);
    }
  }

  recordTelemetry(
    offset?: Coordinates | null,
    source = 'telemetry',
    metadata: CalibrationSampleMetadata = {},
  ): void {
    if (!offset) {
      return;
    }

    const normalized = this.normalize(offset);
    this.telemetry.push({
      offset: normalized,
      source,
      timestamp: Date.now(),
      metadata: { ...metadata },
    });

    if (this.telemetry.length > this.maxHistory) {
      this.telemetry.splice(0, this.telemetry.length - this.maxHistory);
    }
  }

  recordCorrection(
    actual: Coordinates,
    predicted: Coordinates,
    options: RecordCorrectionOptions = 'correction',
  ): Coordinates {
    const metadata =
      typeof options === 'string'
        ? { source: options }
        : (options ?? { source: 'correction' });
    const source = metadata.source ?? 'correction';
    const { source: _ignoredSource, ...sampleMetadata } = metadata;
    const delta = {
      x: actual.x - predicted.x,
      y: actual.y - predicted.y,
    };
    const success =
      sampleMetadata.success === undefined ? true : sampleMetadata.success;
    const error =
      sampleMetadata.error === undefined
        ? this.calculateError(delta)
        : sampleMetadata.error;
    this.captureOffset(delta, source, {
      ...sampleMetadata,
      predicted,
      actual,
      success,
      error,
    });
    return delta;
  }

  getCurrentOffset(): Coordinates | null {
    if (this.samples.length < 10) {
      return { x: 0, y: 0 };
    }

    const recentSamples = this.samples.slice(-50);
    const sum = recentSamples.reduce(
      (acc, sample) => ({
        x: acc.x + sample.offset.x,
        y: acc.y + sample.offset.y,
      }),
      { x: 0, y: 0 },
    );

    const count = recentSamples.length;
    return {
      x: Math.round(sum.x / count),
      y: Math.round(sum.y / count),
    };
  }

  apply(coordinates: Coordinates): Coordinates {
    const offset = this.getCurrentOffset();
    if (!offset) {
      return coordinates;
    }

    return {
      x: Math.round(coordinates.x + offset.x),
      y: Math.round(coordinates.y + offset.y),
    };
  }

  addAdaptiveGuidance<T extends CanvasContextLike>(context: T): T {
    if (!context) {
      return context;
    }

    const offset = this.getCurrentOffset();
    if (!offset) {
      return context;
    }

    const driftThreshold = 5;
    const driftX = Math.round(offset.x);
    const driftY = Math.round(offset.y);
    const driftDetected =
      Math.abs(driftX) > driftThreshold || Math.abs(driftY) > driftThreshold;

    if (!driftDetected) {
      return context;
    }

    const width = context.canvas?.width ?? 0;
    const height = context.canvas?.height ?? 0;
    if (width <= 0 || height <= 0) {
      return context;
    }

    const bannerHeight = Math.max(48, Math.round(height * 0.08));
    const padding = Math.round(bannerHeight * 0.25);
    const primaryFontSize = Math.max(18, Math.round(bannerHeight * 0.4));
    const secondaryFontSize = Math.max(14, Math.round(bannerHeight * 0.3));
    const primaryText = `Calibration drift detected (Δx=${driftX}px, Δy=${driftY}px)`;
    const secondaryText = 'Re-run calibration to realign actions.';

    context.save?.();

    context.globalAlpha = 0.92;
    context.fillStyle = '#2b1b1b';
    context.fillRect(0, 0, width, bannerHeight);

    context.globalAlpha = 1;
    context.fillStyle = '#ffb4b4';
    context.font = `bold ${primaryFontSize}px Arial`;
    context.textBaseline = 'top';
    context.fillText(primaryText, padding, padding / 2);

    context.font = `normal ${secondaryFontSize}px Arial`;
    context.fillStyle = '#ffecec';
    const secondaryY =
      padding / 2 + primaryFontSize + Math.round(padding * 0.2);
    context.fillText(secondaryText, padding, secondaryY);

    context.restore?.();

    return context;
  }

  getHistory(): CalibrationSample[] {
    return [...this.samples];
  }

  reset(): void {
    this.samples.splice(0, this.samples.length);
    this.telemetry.splice(0, this.telemetry.length);
  }

  private normalize(coords: Coordinates): Coordinates {
    return {
      x: Math.round(coords.x),
      y: Math.round(coords.y),
    };
  }

  private calculateError(offset: Coordinates): number {
    return Math.hypot(offset.x, offset.y);
  }
}
