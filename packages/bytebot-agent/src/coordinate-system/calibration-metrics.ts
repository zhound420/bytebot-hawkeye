import { Coordinates } from '../agent/smart-click.types';
import { Calibrator, CalibrationSample } from './calibrator';

export type ConvergenceDirection = 'improving' | 'steady' | 'regressing';

export interface ConvergenceTrendMetrics {
  direction: ConvergenceDirection;
  delta: number | null;
  recentAverage: number | null;
  previousAverage: number | null;
}

export interface RegionalHotspotMetrics {
  key: string;
  center: Coordinates | null;
  attempts: number;
  successRate: number | null;
  averageError: number | null;
  weightedOffset: Coordinates | null;
}

export interface CalibrationLearningMetrics {
  totalAttempts: number;
  successRate: number | null;
  averageError: number | null;
  currentWeightedOffset: Coordinates | null;
  convergenceTrend: ConvergenceTrendMetrics;
  regionalHotspots: RegionalHotspotMetrics[];
}

type CalibratorLike = Pick<
  Calibrator,
  'getHistory' | 'getCurrentOffset' | 'getRegionalBuckets'
>;

interface CalibrationMetricsOptions {
  trendWindowSize?: number;
  hotspotLimit?: number;
  hotspotMinAttempts?: number;
  improvementThreshold?: number;
}

const DEFAULT_OPTIONS: Required<CalibrationMetricsOptions> = {
  trendWindowSize: 20,
  hotspotLimit: 4,
  hotspotMinAttempts: Calibrator.MIN_REGIONAL_SAMPLES,
  improvementThreshold: 0.05,
};

interface ErrorStatistics {
  sum: number;
  count: number;
}

interface SuccessStatistics {
  successes: number;
  total: number;
}

type MetricsLogger = (metrics: CalibrationLearningMetrics) => void;

export class CalibrationMetrics {
  private readonly options: Required<CalibrationMetricsOptions>;

  constructor(
    private readonly calibrator: CalibratorLike,
    options: CalibrationMetricsOptions = {},
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  compute(): CalibrationLearningMetrics {
    const history = this.calibrator.getHistory();
    const totalAttempts = history.length;
    const successStats = this.calculateSuccessRate(history);
    const averageError = this.calculateAverageError(history);
    const currentWeightedOffset = this.calibrator.getCurrentOffset();
    const convergenceTrend = this.calculateConvergenceTrend(history);
    const regionalHotspots = this.calculateRegionalHotspots();

    return {
      totalAttempts,
      successRate: successStats,
      averageError,
      currentWeightedOffset,
      convergenceTrend,
      regionalHotspots,
    };
  }

  startMetricsLogging(
    intervalMs = 60_000,
    logger: MetricsLogger = (metrics) => console.log(metrics),
  ): () => void {
    const execute = () => {
      try {
        logger(this.compute());
      } catch (error) {
        // Swallow errors to avoid breaking logging loops. Consumers can wrap logger.
        void error;
      }
    };

    execute();
    const timer = setInterval(execute, intervalMs);
    return () => clearInterval(timer);
  }

  private calculateSuccessRate(history: CalibrationSample[]): number | null {
    const stats = history.reduce<SuccessStatistics>(
      (acc, sample) => {
        if (sample.success === null || sample.success === undefined) {
          return acc;
        }
        return {
          successes: acc.successes + (sample.success ? 1 : 0),
          total: acc.total + 1,
        };
      },
      { successes: 0, total: 0 },
    );

    if (stats.total === 0) {
      return null;
    }

    return stats.successes / stats.total;
  }

  private calculateAverageError(history: CalibrationSample[]): number | null {
    const stats = history.reduce<ErrorStatistics>(
      (acc, sample) => {
        const error = sample.error;
        if (typeof error !== 'number' || !Number.isFinite(error)) {
          return acc;
        }
        return { sum: acc.sum + Math.abs(error), count: acc.count + 1 };
      },
      { sum: 0, count: 0 },
    );

    if (stats.count === 0) {
      return null;
    }

    return stats.sum / stats.count;
  }

  private calculateConvergenceTrend(
    history: CalibrationSample[],
  ): ConvergenceTrendMetrics {
    const windowSize = Math.max(5, this.options.trendWindowSize);
    const recentErrors = this.collectErrors(history.slice(-windowSize));
    const previousErrors = this.collectErrors(
      history.slice(-windowSize * 2, -windowSize),
    );

    const recentAverage = this.averageFromStats(recentErrors);
    const previousAverage = this.averageFromStats(previousErrors);

    if (recentAverage === null || previousAverage === null) {
      return {
        direction: 'steady',
        delta: null,
        recentAverage,
        previousAverage,
      };
    }

    const delta = recentAverage - previousAverage;
    const baseline = Math.max(previousAverage, 1);
    const normalizedDelta = delta / baseline;
    const threshold = this.options.improvementThreshold;

    let direction: ConvergenceDirection = 'steady';
    if (normalizedDelta <= -threshold) {
      direction = 'improving';
    } else if (normalizedDelta >= threshold) {
      direction = 'regressing';
    }

    return {
      direction,
      delta,
      recentAverage,
      previousAverage,
    };
  }

  private calculateRegionalHotspots(): RegionalHotspotMetrics[] {
    const buckets = this.calibrator.getRegionalBuckets();
    if (!Array.isArray(buckets) || !buckets.length) {
      return [];
    }

    const hotspots = buckets
      .filter((bucket) => bucket.samples.length >= this.options.hotspotMinAttempts)
      .map((bucket) => {
        const samples = bucket.samples;
        const errorStats = this.collectErrors(samples);
        const successStats = samples.reduce<SuccessStatistics>(
          (acc, sample) => {
            if (sample.success === null || sample.success === undefined) {
              return acc;
            }
            return {
              successes: acc.successes + (sample.success ? 1 : 0),
              total: acc.total + 1,
            };
          },
          { successes: 0, total: 0 },
        );

        return {
          key: bucket.key,
          center: bucket.center ?? null,
          attempts: samples.length,
          successRate:
            successStats.total > 0
              ? successStats.successes / successStats.total
              : null,
          averageError: this.averageFromStats(errorStats),
          weightedOffset: bucket.weightedOffset ?? null,
        } satisfies RegionalHotspotMetrics;
      })
      .sort((a, b) => {
        const aError = a.averageError ?? 0;
        const bError = b.averageError ?? 0;
        if (bError !== aError) {
          return bError - aError;
        }
        return b.attempts - a.attempts;
      });

    return hotspots.slice(0, this.options.hotspotLimit);
  }

  private collectErrors(samples: CalibrationSample[]): ErrorStatistics {
    return samples.reduce<ErrorStatistics>(
      (acc, sample) => {
        const error = sample.error;
        if (typeof error !== 'number' || !Number.isFinite(error)) {
          return acc;
        }
        return { sum: acc.sum + Math.abs(error), count: acc.count + 1 };
      },
      { sum: 0, count: 0 },
    );
  }

  private averageFromStats(stats: ErrorStatistics): number | null {
    if (stats.count === 0) {
      return null;
    }
    return stats.sum / stats.count;
  }
}
