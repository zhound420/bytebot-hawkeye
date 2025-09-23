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

export type RecordSuccessOptions = RecordCorrectionOptions;

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
  private readonly regionalSamples = new Map<string, CalibrationSample[]>();
  private readonly maxHistory: number;

  private static readonly REGION_BUCKET_SIZE = 200;
  private static readonly MIN_REGIONAL_SAMPLES = 3;

  constructor(maxHistory = 50) {
    this.maxHistory = Math.max(maxHistory, 50);
  }

  captureOffset(
    offset?: Coordinates | null,
    source = 'screenshot',
    metadata: CalibrationSampleMetadata = {},
  ): CalibrationSample | null {
    if (!offset) {
      return null;
    }

    const normalized = this.normalize(offset);
    const success = metadata.success === undefined ? null : metadata.success;
    const error =
      metadata.error === undefined
        ? this.calculateError(normalized)
        : metadata.error;
    const sample: CalibrationSample = {
      offset: normalized,
      predicted: metadata.predicted ?? null,
      actual: metadata.actual ?? null,
      success,
      targetDescription: metadata.targetDescription ?? null,
      error,
      timestamp: Date.now(),
      source,
    };

    this.samples.push(sample);

    if (this.samples.length > this.maxHistory) {
      this.samples.splice(0, this.samples.length - this.maxHistory);
    }

    return sample;
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
    const sample = this.captureOffset(delta, source, {
      ...sampleMetadata,
      predicted,
      actual,
      success,
      error,
    });
    this.addRegionalSample(predicted, sample);
    return delta;
  }

  recordSuccess(
    coordinates: Coordinates,
    options: RecordSuccessOptions = 'success',
  ): void {
    const metadata =
      typeof options === 'string'
        ? { source: options }
        : (options ?? { source: 'success' });
    const source = metadata.source ?? 'success';
    const normalized = this.normalize(coordinates);
    const { source: _ignoredSource, ...sampleMetadata } = metadata;
    const success =
      sampleMetadata.success === undefined ? true : sampleMetadata.success;
    const predicted = sampleMetadata.predicted ?? normalized;
    const actual = sampleMetadata.actual ?? normalized;
    const error = sampleMetadata.error === undefined ? 0 : sampleMetadata.error;
    const sample = this.captureOffset({ x: 0, y: 0 }, source, {
      ...sampleMetadata,
      predicted,
      actual,
      success,
      error,
    });
    this.addRegionalSample(predicted, sample);
  }

  getCurrentOffset(): Coordinates | null {
    return this.computeWeightedOffset(this.samples) ?? { x: 0, y: 0 };
  }

  getRegionalOffset(predicted: Coordinates | null): Coordinates | null {
    const key = this.getRegionKey(predicted);
    if (!key) {
      return this.getCurrentOffset();
    }

    const samples = this.regionalSamples.get(key);
    if (!samples || samples.length < Calibrator.MIN_REGIONAL_SAMPLES) {
      return this.getCurrentOffset();
    }

    return (
      this.computeWeightedOffset(samples, Calibrator.MIN_REGIONAL_SAMPLES) ??
      this.getCurrentOffset()
    );
  }

  apply(coordinates: Coordinates): Coordinates {
    const offset = this.getRegionalOffset(coordinates);
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
    this.regionalSamples.clear();
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

  private getRegionKey(coords?: Coordinates | null): string | null {
    if (!coords) {
      return null;
    }

    const normalized = this.normalize(coords);
    const bucketX = Math.floor(normalized.x / Calibrator.REGION_BUCKET_SIZE);
    const bucketY = Math.floor(normalized.y / Calibrator.REGION_BUCKET_SIZE);
    return `${bucketX},${bucketY}`;
  }

  private addRegionalSample(
    predicted: Coordinates | null,
    sample: CalibrationSample | null,
  ): void {
    if (!sample) {
      return;
    }

    const key = this.getRegionKey(predicted ?? sample.predicted);
    if (!key) {
      return;
    }

    const samples = this.regionalSamples.get(key) ?? [];
    samples.push(sample);

    if (samples.length > this.maxHistory) {
      samples.splice(0, samples.length - this.maxHistory);
    }

    this.regionalSamples.set(key, samples);
  }

  private computeWeightedOffset(
    samples: CalibrationSample[],
    minSamples = 5,
  ): Coordinates | null {
    const recentSamples = samples.slice(-50);

    if (recentSamples.length < minSamples) {
      return null;
    }

    const { weighted, totalWeight } = recentSamples.reduce(
      (acc, sample, index) => {
        const age = recentSamples.length - index;
        const baseWeight = 1 / Math.sqrt(age);
        const weight = sample.success ? baseWeight * 1.5 : baseWeight;

        return {
          weighted: {
            x: acc.weighted.x + sample.offset.x * weight,
            y: acc.weighted.y + sample.offset.y * weight,
          },
          totalWeight: acc.totalWeight + weight,
        };
      },
      { weighted: { x: 0, y: 0 }, totalWeight: 0 },
    );

    if (totalWeight === 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: Math.round(weighted.x / totalWeight),
      y: Math.round(weighted.y / totalWeight),
    };
  }
}
