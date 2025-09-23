import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import {
  TelemetryActionEventSummary,
  SessionSummaryInfo,
  TelemetryService,
  InvalidSessionIdError,
} from './telemetry.service';
import * as fs from 'fs/promises';

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Get('summary')
  async summary(
    @Query('app') app?: string,
    @Query('limit') limitStr?: string,
    @Query('session') sessionId?: string,
  ): Promise<{
    targetedClicks: number;
    untargetedClicks: number;
    avgAbsDelta: number | null;
    avgDeltaX: number | null;
    avgDeltaY: number | null;
    calibrationSnapshots: number;
    recentAbsDeltas?: number[];
    actionCounts?: Record<string, number>;
    retryClicks?: number;
    hoverProbes?: { count: number; avgDiff: number | null };
    postClickDiff?: { count: number; avgDiff: number | null };
    smartClicks?: number;
    progressiveZooms?: number;
    learningMetrics: LearningMetricsSummary;
    sessionStart: string | null;
    sessionEnd: string | null;
    sessionDurationMs: number | null;
    events: TelemetryActionEventSummary[];
  }> {
    try {
      const logPath = this.telemetry.getLogFilePath(sessionId);
      const timeline = await this.telemetry.getSessionTimeline(sessionId);
      let targeted = 0;
      let untargeted = 0;
      let sumAbs = 0;
      let sumDx = 0;
      let sumDy = 0;
      const recentAbsDeltas: number[] = [];
      const limit = Math.max(
        5,
        Math.min(parseInt(limitStr || '20', 10) || 20, 100),
      );

      let retryClicks = 0;
      let hoverCount = 0;
      let hoverSum = 0;
      let postCount = 0;
      let postSum = 0;
      const actionCounts = new Map<string, number>();
      let smartClicks = 0;
      let progressiveZooms = 0;

      let learningMetrics: LearningMetricsSummary = createDefaultLearningMetrics();
      try {
        const content = await fs.readFile(logPath, 'utf8');
        const lines = content.split('\n').filter(Boolean);

        const entries: ParsedTelemetryEntry[] = [];
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            const timestamp =
              typeof obj?.timestamp === 'string' ? obj.timestamp : null;
            const timestampMs = timestamp ? Date.parse(timestamp) : Number.NaN;
            entries.push({
              raw: obj,
              timestamp,
              timestampMs: Number.isFinite(timestampMs) ? timestampMs : null,
            });
          } catch (error) {
            // Ignore malformed telemetry entries in pre-pass
          }
        }

        const smartClickCompletionIds = new Set<string>();
        for (const entry of entries) {
          const obj = entry.raw;
          if (obj?.type === 'smart_click_complete') {
            const taskId =
              typeof obj.clickTaskId === 'string' ? obj.clickTaskId : undefined;
            if (taskId) {
              smartClickCompletionIds.add(taskId);
            }
          }
        }

        const countedTaskIds = new Set<string>();
        const attemptSamples: AttemptSample[] = [];
        const regionalAttempts = new Map<string, AttemptSample[]>();

        for (const entry of entries) {
          const obj = entry.raw;
          if (app && obj?.app && obj.app !== app) {
            continue;
          }

          if (obj?.type === 'smart_click_complete') {
            const taskId =
              typeof obj.clickTaskId === 'string'
                ? obj.clickTaskId
                : undefined;
            if (taskId && countedTaskIds.has(taskId)) {
              continue;
            }
            if (taskId) {
              countedTaskIds.add(taskId);
            }

            const delta = extractDelta(obj);
            if (delta) {
              targeted++;
              sumDx += delta.x;
              sumDy += delta.y;
              const distance = extractDistance(obj, delta);
              sumAbs += distance;
              attemptSamples.push(
                createAttemptSample(obj, delta, distance, entry.timestampMs),
              );
            }

            if (attemptSamples.length) {
              const sample = attemptSamples[attemptSamples.length - 1];
              if (sample.regionKey) {
                const existing = regionalAttempts.get(sample.regionKey) ?? [];
                existing.push(sample);
                regionalAttempts.set(sample.regionKey, existing);
              }
            }

            if (recentAbsDeltas.length >= limit) {
              recentAbsDeltas.shift();
            }
            if (attemptSamples.length) {
              const sample = attemptSamples[attemptSamples.length - 1];
              if (typeof sample.error === 'number' && Number.isFinite(sample.error)) {
                recentAbsDeltas.push(sample.error);
              }
            }

            if (obj.success === true) {
              smartClicks += 1;
            }
            continue;
          }

          if (obj?.type === 'untargeted_click') {
            untargeted++;
            continue;
          }

          if (obj?.type === 'retry_click') {
            retryClicks += Number(obj.attempts) || 1;
            continue;
          }

          if (obj?.type === 'hover_probe') {
            const d = Number(obj.diff) || 0;
            hoverCount++;
            hoverSum += d;
            continue;
          }

          if (obj?.type === 'post_click_diff') {
            const d = Number(obj.diff) || 0;
            postCount++;
            postSum += d;
            continue;
          }

          if (obj?.type === 'action' && obj.name) {
            actionCounts.set(obj.name, (actionCounts.get(obj.name) || 0) + 1);
            if (
              obj.name === 'screenshot_region' ||
              obj.name === 'screenshot_custom_region'
            ) {
              progressiveZooms += 1;
            }
            continue;
          }

          if (obj?.type === 'progressive_zoom') {
            progressiveZooms += 1;
            continue;
          }

          const hasTargetedPayload = obj?.target && obj?.actual && obj?.delta;
          if (!hasTargetedPayload) {
            continue;
          }

          const clickTaskId =
            typeof obj.clickTaskId === 'string' ? obj.clickTaskId : undefined;
          if (clickTaskId && countedTaskIds.has(clickTaskId)) {
            continue;
          }
          if (clickTaskId && smartClickCompletionIds.has(clickTaskId)) {
            continue;
          }
          if (clickTaskId) {
            countedTaskIds.add(clickTaskId);
          }

          const delta = extractDelta(obj);
          if (!delta) {
            continue;
          }

          targeted++;
          sumDx += delta.x;
          sumDy += delta.y;
          const distance = Math.hypot(delta.x, delta.y);
          sumAbs += distance;

          const sample = createAttemptSample(
            obj,
            delta,
            distance,
            entry.timestampMs,
          );
          attemptSamples.push(sample);
          if (sample.regionKey) {
            const existing = regionalAttempts.get(sample.regionKey) ?? [];
            existing.push(sample);
            regionalAttempts.set(sample.regionKey, existing);
          }
          if (recentAbsDeltas.length >= limit) {
            recentAbsDeltas.shift();
          }
          if (typeof sample.error === 'number' && Number.isFinite(sample.error)) {
            recentAbsDeltas.push(sample.error);
          }
        }

        learningMetrics = computeLearningMetrics(attemptSamples, regionalAttempts);
      } catch (error) {
        learningMetrics = createDefaultLearningMetrics();
      }

      let calibrationSnapshots = 0;
      try {
        const dir = this.telemetry.getCalibrationDir(sessionId);
        const files = await fs.readdir(dir);
        calibrationSnapshots = files.filter((f) => f.endsWith('.png')).length;
      } catch (error) {
        // Ignore missing calibration directories
      }

      return {
        targetedClicks: targeted,
        untargetedClicks: untargeted,
        avgAbsDelta: targeted ? sumAbs / targeted : null,
        avgDeltaX: targeted ? sumDx / targeted : null,
        avgDeltaY: targeted ? sumDy / targeted : null,
        calibrationSnapshots,
        recentAbsDeltas,
        actionCounts: Object.fromEntries(actionCounts.entries()),
        retryClicks,
        hoverProbes: {
          count: hoverCount,
          avgDiff: hoverCount ? hoverSum / hoverCount : null,
        },
        postClickDiff: {
          count: postCount,
          avgDiff: postCount ? postSum / postCount : null,
        },
        smartClicks,
        progressiveZooms,
        learningMetrics,
        sessionStart: timeline.sessionStart,
        sessionEnd: timeline.sessionEnd,
        sessionDurationMs: timeline.sessionDurationMs,
        events: timeline.events,
      };
    } catch (error) {
      this.handleSessionError(error);
    }
  }

  @Post('event')
  async event(@Body() body: any) {
    const type = typeof body?.type === 'string' ? body.type : 'custom';
    const data = body && typeof body === 'object' ? body : {};
    await this.telemetry.recordEvent(type, data);
    return { ok: true };
  }

  @Post('reset')
  async reset(
    @Query('session') sessionId?: string,
    @Body('session') bodySessionId?: string,
  ) {
    try {
      const rawSession = sessionId ?? bodySessionId;
      const targetSession = rawSession?.trim();
      await this.telemetry.resetAll(targetSession || undefined);
      return { ok: true };
    } catch (error) {
      this.handleSessionError(error);
    }
  }

  @Get('apps')
  async apps(
    @Query('limit') limitStr?: string,
    @Query('window') windowStr?: string,
    @Query('session') sessionId?: string,
  ): Promise<{ apps: Array<{ name: string; count: number }> }> {
    try {
      const logPath = this.telemetry.getLogFilePath(sessionId);
      const limit = Math.max(
        1,
        Math.min(parseInt(limitStr || '10', 10) || 10, 50),
      );
      const windowSize = Math.max(
        100,
        Math.min(parseInt(windowStr || '2000', 10) || 2000, 20000),
      );

      const counts = new Map<string, number>();
      try {
        const content = await fs.readFile(logPath, 'utf8');
        const lines = content.split('\n').filter(Boolean);
        const start = Math.max(0, lines.length - windowSize);
        for (let i = lines.length - 1; i >= start; i--) {
          try {
            const obj = JSON.parse(lines[i]);
            if (!obj.app) continue;
            counts.set(obj.app, (counts.get(obj.app) || 0) + 1);
          } catch (error) {
            // Ignore malformed telemetry entries in app aggregation
          }
        }
      } catch (error) {
        // Ignore missing telemetry log when aggregating app usage
      }

      const apps = Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
      return { apps };
    } catch (error) {
      this.handleSessionError(error);
    }
  }

  @Get('sessions')
  async sessions(): Promise<{
    current: string;
    sessions: SessionSummaryInfo[];
  }> {
    return this.telemetry.listSessions();
  }

  private handleSessionError(error: unknown): never {
    if (error instanceof InvalidSessionIdError) {
      throw new BadRequestException('Invalid session identifier');
    }
    throw error;
  }
}

type CoordinatesLike = { x: number; y: number };

interface LearningMetricsSummary {
  totalAttempts: number;
  successRate: number | null;
  averageError: number | null;
  currentWeightedOffset: CoordinatesLike | null;
  convergenceTrend: {
    direction: 'improving' | 'steady' | 'regressing';
    delta: number | null;
    recentAverage: number | null;
    previousAverage: number | null;
  };
  regionalHotspots: Array<{
    key: string;
    center: CoordinatesLike | null;
    attempts: number;
    successRate: number | null;
    averageError: number | null;
    weightedOffset: CoordinatesLike | null;
  }>;
}

interface ParsedTelemetryEntry {
  raw: Record<string, any>;
  timestamp: string | null;
  timestampMs: number | null;
}

interface AttemptSample {
  error: number | null;
  success: boolean | null;
  timestampMs: number | null;
  offset: CoordinatesLike | null;
  regionKey: string | null;
  regionCenter: CoordinatesLike | null;
}

const REGION_BUCKET_SIZE = 200;
const HOTSPOT_LIMIT = 4;
const HOTSPOT_MIN_ATTEMPTS = 3;
const TREND_WINDOW = 20;
const TREND_THRESHOLD = 0.05;

function createDefaultLearningMetrics(): LearningMetricsSummary {
  return {
    totalAttempts: 0,
    successRate: null,
    averageError: null,
    currentWeightedOffset: null,
    convergenceTrend: {
      direction: 'steady',
      delta: null,
      recentAverage: null,
      previousAverage: null,
    },
    regionalHotspots: [],
  };
}

function extractDelta(candidate: Record<string, any>): CoordinatesLike | null {
  const delta = candidate?.delta;
  if (!delta || typeof delta !== 'object') {
    return null;
  }
  const x = Number(delta.x);
  const y = Number(delta.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

function extractDistance(
  candidate: Record<string, any>,
  delta: CoordinatesLike,
): number {
  const providedDistance = Number(candidate?.distance);
  if (Number.isFinite(providedDistance) && providedDistance > 0) {
    return providedDistance;
  }
  return Math.hypot(delta.x, delta.y);
}

function extractCoordinates(candidate: any): CoordinatesLike | null {
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const x = Number(candidate.x);
  const y = Number(candidate.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  return { x, y };
}

function determineRegion(
  candidate: Record<string, any>,
): { key: string; center: CoordinatesLike } | null {
  const source =
    extractCoordinates(candidate.actual) ??
    extractCoordinates(candidate.predicted) ??
    extractCoordinates(candidate.target);
  if (!source) {
    return null;
  }
  const normalizedX = Math.round(source.x);
  const normalizedY = Math.round(source.y);
  if (!Number.isFinite(normalizedX) || !Number.isFinite(normalizedY)) {
    return null;
  }
  const bucketX = Math.floor(normalizedX / REGION_BUCKET_SIZE);
  const bucketY = Math.floor(normalizedY / REGION_BUCKET_SIZE);
  const key = `${bucketX},${bucketY}`;
  const center = {
    x: bucketX * REGION_BUCKET_SIZE + REGION_BUCKET_SIZE / 2,
    y: bucketY * REGION_BUCKET_SIZE + REGION_BUCKET_SIZE / 2,
  } satisfies CoordinatesLike;
  return { key, center };
}

function createAttemptSample(
  candidate: Record<string, any>,
  delta: CoordinatesLike,
  distance: number,
  timestampMs: number | null,
): AttemptSample {
  const region = determineRegion(candidate);
  const success =
    typeof candidate?.success === 'boolean' ? candidate.success : null;
  return {
    error: Number.isFinite(distance) ? distance : null,
    success,
    timestampMs: timestampMs ?? null,
    offset: delta,
    regionKey: region?.key ?? null,
    regionCenter: region?.center ?? null,
  };
}

function computeLearningMetrics(
  samples: AttemptSample[],
  regionalSamples: Map<string, AttemptSample[]>,
): LearningMetricsSummary {
  if (!samples.length) {
    return createDefaultLearningMetrics();
  }

  const successStats = samples.reduce(
    (acc, sample) => {
      if (sample.success === null) {
        return acc;
      }
      return {
        successes: acc.successes + (sample.success ? 1 : 0),
        total: acc.total + 1,
      };
    },
    { successes: 0, total: 0 },
  );

  const errorStats = samples.reduce(
    (acc, sample) => {
      if (typeof sample.error !== 'number' || !Number.isFinite(sample.error)) {
        return acc;
      }
      return {
        sum: acc.sum + Math.abs(sample.error),
        count: acc.count + 1,
      };
    },
    { sum: 0, count: 0 },
  );

  const averageError = errorStats.count ? errorStats.sum / errorStats.count : null;
  const successRate = successStats.total
    ? successStats.successes / successStats.total
    : null;

  return {
    totalAttempts: samples.length,
    successRate,
    averageError,
    currentWeightedOffset: computeWeightedOffsetFromSamples(samples),
    convergenceTrend: computeConvergenceTrend(samples),
    regionalHotspots: computeRegionalHotspots(regionalSamples),
  };
}

function computeWeightedOffsetFromSamples(
  samples: AttemptSample[],
): CoordinatesLike | null {
  const relevant = samples.filter((sample) => sample.offset !== null);
  const recentSamples = relevant.slice(-50);
  if (recentSamples.length < 5) {
    return null;
  }

  const aggregate = recentSamples.reduce(
    (acc, sample, index) => {
      const offset = sample.offset ?? { x: 0, y: 0 };
      const age = recentSamples.length - index;
      const baseWeight = 1 / Math.sqrt(age);
      const weight =
        sample.success === true ? baseWeight * 1.5 : baseWeight;
      return {
        weighted: {
          x: acc.weighted.x + offset.x * weight,
          y: acc.weighted.y + offset.y * weight,
        },
        totalWeight: acc.totalWeight + weight,
      };
    },
    { weighted: { x: 0, y: 0 }, totalWeight: 0 },
  );

  if (aggregate.totalWeight === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: Math.round(aggregate.weighted.x / aggregate.totalWeight),
    y: Math.round(aggregate.weighted.y / aggregate.totalWeight),
  };
}

function computeConvergenceTrend(
  samples: AttemptSample[],
): LearningMetricsSummary['convergenceTrend'] {
  const windowSize = Math.max(5, Math.min(TREND_WINDOW, samples.length));
  const errorValues = samples
    .map((sample) =>
      typeof sample.error === 'number' && Number.isFinite(sample.error)
        ? Math.abs(sample.error)
        : null,
    )
    .filter((value): value is number => value !== null);

  const recent = errorValues.slice(-windowSize);
  const previous = errorValues.slice(-windowSize * 2, -windowSize);

  const recentAverage = recent.length
    ? recent.reduce((sum, value) => sum + value, 0) / recent.length
    : null;
  const previousAverage = previous.length
    ? previous.reduce((sum, value) => sum + value, 0) / previous.length
    : null;

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
  const normalized = delta / baseline;

  let direction: 'improving' | 'steady' | 'regressing' = 'steady';
  if (normalized <= -TREND_THRESHOLD) {
    direction = 'improving';
  } else if (normalized >= TREND_THRESHOLD) {
    direction = 'regressing';
  }

  return { direction, delta, recentAverage, previousAverage };
}

function computeRegionalHotspots(
  regionalSamples: Map<string, AttemptSample[]>,
): LearningMetricsSummary['regionalHotspots'] {
  const entries = Array.from(regionalSamples.entries()).map(
    ([key, samples]) => {
      const successStats = samples.reduce(
        (acc, sample) => {
          if (sample.success === null) {
            return acc;
          }
          return {
            successes: acc.successes + (sample.success ? 1 : 0),
            total: acc.total + 1,
          };
        },
        { successes: 0, total: 0 },
      );

      const errorStats = samples.reduce(
        (acc, sample) => {
          if (typeof sample.error !== 'number' || !Number.isFinite(sample.error)) {
            return acc;
          }
          return {
            sum: acc.sum + Math.abs(sample.error),
            count: acc.count + 1,
          };
        },
        { sum: 0, count: 0 },
      );

      const averageError = errorStats.count
        ? errorStats.sum / errorStats.count
        : null;
      const successRate = successStats.total
        ? successStats.successes / successStats.total
        : null;
      const weightedOffset = computeWeightedOffsetFromSamples(samples);
      const regionCenter = samples.find((sample) => sample.regionCenter)?.regionCenter ?? null;

      return {
        key,
        center: regionCenter,
        attempts: samples.length,
        successRate,
        averageError,
        weightedOffset,
      };
    },
  );

  return entries
    .filter((entry) => entry.attempts >= HOTSPOT_MIN_ATTEMPTS)
    .sort((a, b) => {
      const aError = a.averageError ?? 0;
      const bError = b.averageError ?? 0;
      if (bError !== aError) {
        return bError - aError;
      }
      return b.attempts - a.attempts;
    })
    .slice(0, HOTSPOT_LIMIT);
}
