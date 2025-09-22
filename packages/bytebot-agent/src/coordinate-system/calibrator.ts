import { Coordinates } from '../agent/smart-click.types';

export interface CalibrationSample {
  offset: Coordinates;
  timestamp: number;
  source: string;
}

export class Calibrator {
  private readonly samples: CalibrationSample[] = [];

  constructor(private readonly maxHistory: number = 6) {}

  captureOffset(offset?: Coordinates | null, source = 'screenshot'): void {
    if (!offset) {
      return;
    }

    const normalized = this.normalize(offset);
    this.samples.push({
      offset: normalized,
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
    source = 'correction',
  ): Coordinates {
    const delta = {
      x: actual.x - predicted.x,
      y: actual.y - predicted.y,
    };
    this.captureOffset(delta, source);
    return delta;
  }

  getCurrentOffset(): Coordinates | null {
    if (this.samples.length === 0) {
      return null;
    }

    const sum = this.samples.reduce(
      (acc, sample) => ({
        x: acc.x + sample.offset.x,
        y: acc.y + sample.offset.y,
      }),
      { x: 0, y: 0 },
    );

    const count = this.samples.length;
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
}
