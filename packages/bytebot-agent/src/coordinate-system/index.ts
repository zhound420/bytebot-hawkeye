import {
  Coordinates,
  ScreenshotCustomRegionOptions,
  ScreenshotFnOptions,
  ScreenshotResponse,
  SmartClickAI,
} from '../agent/smart-click.types';
import { Calibrator, RecordCorrectionOptions } from './calibrator';
import { CoordinateParser } from './coordinate-parser';
import { CoordinateTeacher } from './coordinate-teacher';
import {
  UniversalCoordinateRefiner,
  UniversalCoordinateResult,
  UniversalCoordinateStep,
  UniversalRefinerOptions,
} from './universal-refiner';

export type {
  Coordinates,
  ScreenshotCustomRegionOptions,
  ScreenshotFnOptions,
  ScreenshotResponse,
  SmartClickAI,
  UniversalCoordinateResult,
  UniversalCoordinateStep,
  UniversalRefinerOptions,
};

export {
  Calibrator,
  CoordinateParser,
  CoordinateTeacher,
  UniversalCoordinateRefiner,
};

export class UniversalCoordinateSystem {
  private readonly teacher = new CoordinateTeacher();
  private readonly parser = new CoordinateParser();
  private readonly calibrator = new Calibrator();
  private readonly refiner: UniversalCoordinateRefiner;

  constructor(options: {
    ai: SmartClickAI;
    capture: {
      full: (options: ScreenshotFnOptions) => Promise<ScreenshotResponse>;
      zoom: (
        options: ScreenshotCustomRegionOptions,
      ) => Promise<ScreenshotResponse>;
    };
  }) {
    this.refiner = new UniversalCoordinateRefiner(
      options.ai,
      this.teacher,
      this.parser,
      this.calibrator,
      options.capture,
    );
  }

  async locate(
    targetDescription: string,
    options?: UniversalRefinerOptions,
  ): Promise<UniversalCoordinateResult> {
    return this.refiner.locate(targetDescription, options);
  }

  getCalibrationHistory() {
    return this.calibrator.getHistory();
  }

  resetCalibration(): void {
    this.calibrator.reset();
  }

  recordCorrection(
    actual: Coordinates,
    predicted: Coordinates,
    options?: RecordCorrectionOptions,
  ) {
    return this.calibrator.recordCorrection(
      actual,
      predicted,
      options ?? 'correction',
    );
  }
}
