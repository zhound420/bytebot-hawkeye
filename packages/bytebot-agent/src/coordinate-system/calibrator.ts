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

export class Calibrator {
  private readonly samples: CalibrationSample[] = [];
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
    const success =
      metadata.success === undefined ? null : metadata.success;
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

  recordCorrection(
    actual: Coordinates,
    predicted: Coordinates,
    options: RecordCorrectionOptions = 'correction',
  ): Coordinates {
    const metadata =
      typeof options === 'string'
        ? { source: options }
        : options ?? { source: 'correction' };
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

  getHistory(): CalibrationSample[] {
    return [...this.samples];
  }

  reset(): void {
    this.samples.splice(0, this.samples.length);
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
