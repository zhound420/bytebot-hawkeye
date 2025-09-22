import { Injectable, Logger } from '@nestjs/common';
import { UNIVERSAL_COORDINATES_CONFIG } from '@bytebot/shared';
import * as fs from 'fs/promises';
import { exec as execCb } from 'child_process';
import { promisify } from 'util';
const exec = promisify(execCb);
import * as path from 'path';

export class InvalidSessionIdError extends Error {
  constructor(public readonly sessionId: string | undefined) {
    super('Invalid session identifier');
  }
}

interface DriftOffset {
  x: number;
  y: number;
}

export interface ClickContextMeta {
  region?: { x: number; y: number; width: number; height: number };
  zoomLevel?: number;
  targetDescription?: string;
  source?: string;
  clickTaskId?: string;
}

export interface TelemetryActionEventSummary {
  type: string;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface SessionTimelineSummary {
  sessionStart: string | null;
  sessionEnd: string | null;
  sessionDurationMs: number | null;
  events: TelemetryActionEventSummary[];
}

export interface SessionSummaryInfo {
  id: string;
  sessionStart: string | null;
  sessionEnd: string | null;
  sessionDurationMs: number | null;
}

interface ClickTelemetryPayload {
  target: { x: number; y: number };
  adjusted?: { x: number; y: number };
  actual: { x: number; y: number };
  delta: { x: number; y: number };
  region?: { x: number; y: number; width: number; height: number };
  zoomLevel?: number;
  targetDescription?: string;
  source?: string;
  timestamp: string;
}

@Injectable()
export class TelemetryService {
  private static readonly SESSION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

  private readonly logger = new Logger(TelemetryService.name);
  private readonly telemetryEnabled = process.env.BYTEBOT_TELEMETRY !== 'false';
  private readonly driftCompensationEnabled =
    process.env.BYTEBOT_DRIFT_COMPENSATION !== 'false';
  private readonly calibrationEnabled =
    process.env.BYTEBOT_POST_CLICK_CALIBRATION !== undefined
      ? process.env.BYTEBOT_POST_CLICK_CALIBRATION === 'true'
      : UNIVERSAL_COORDINATES_CONFIG.calibration.enablePostClick;
  private readonly smoothingFactor = Number.parseFloat(
    process.env.BYTEBOT_DRIFT_SMOOTHING ?? '0.2',
  );
  private readonly telemetryDir = path.resolve(
    process.env.BYTEBOT_TELEMETRY_DIR ?? path.join('/tmp', 'bytebot-telemetry'),
  );
  private readonly ready: Promise<void>;
  private currentSessionId = 'default';
  private drift: DriftOffset = { x: 0, y: 0 };

  constructor() {
    this.ready = this.initialise();
  }

  static isValidSessionId(sessionId: string): boolean {
    return TelemetryService.SESSION_ID_PATTERN.test(sessionId);
  }

  private normalizeSessionId(sessionId?: string): string | undefined {
    if (sessionId === undefined || sessionId === null) {
      return undefined;
    }
    const trimmed = sessionId.trim();
    if (!trimmed) {
      return undefined;
    }
    if (!TelemetryService.isValidSessionId(trimmed)) {
      throw new InvalidSessionIdError(sessionId);
    }
    return trimmed;
  }

  getLogFilePath(sessionId?: string): string {
    const normalized = this.normalizeSessionId(sessionId);
    return this.resolveLogFilePath(normalized);
  }

  getCalibrationDir(sessionId?: string): string {
    const normalized = this.normalizeSessionId(sessionId);
    return this.resolveCalibrationDir(normalized);
  }

  private async initialise(): Promise<void> {
    try {
      await fs.mkdir(this.telemetryDir, { recursive: true });
      await this.ensureSessionDirectories(this.currentSessionId);
      await this.loadDriftForSession(this.currentSessionId);
    } catch (error) {
      this.logger.warn(
        `Failed to initialise telemetry: ${(error as Error).message}`,
      );
    }
  }

  async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  isTelemetryEnabled(): boolean {
    return this.telemetryEnabled;
  }

  isCalibrationEnabled(): boolean {
    return this.telemetryEnabled && this.calibrationEnabled;
  }

  isDriftCompensationEnabled(): boolean {
    return this.telemetryEnabled && this.driftCompensationEnabled;
  }

  async getCurrentDrift(): Promise<DriftOffset> {
    await this.ready;
    return { ...this.drift };
  }

  async startSession(sessionId: string): Promise<void> {
    const normalized = this.normalizeSessionId(sessionId);
    if (!normalized) {
      throw new InvalidSessionIdError(sessionId);
    }
    await this.ready;
    await this.ensureSessionDirectories(normalized);
    this.currentSessionId = normalized;
    await this.loadDriftForSession(normalized);
  }

  async listSessions(): Promise<{
    current: string;
    sessions: SessionSummaryInfo[];
  }> {
    await this.ready;
    try {
      const entries = await fs.readdir(this.telemetryDir, {
        withFileTypes: true,
      });
      const sessions = entries
        .filter(
          (entry) =>
            entry.isDirectory() && TelemetryService.isValidSessionId(entry.name),
        )
        .map((entry) => entry.name)
        .sort();
      if (!sessions.includes(this.currentSessionId)) {
        sessions.unshift(this.currentSessionId);
      }
      const uniqueSessions = Array.from(new Set(sessions));
      const summaries = await Promise.all(
        uniqueSessions.map(async (id) => {
          const timeline = await this.getSessionTimeline(id, { eventLimit: 0 });
          return {
            id,
            sessionStart: timeline.sessionStart,
            sessionEnd: timeline.sessionEnd,
            sessionDurationMs: timeline.sessionDurationMs,
          } satisfies SessionSummaryInfo;
        }),
      );
      return { current: this.currentSessionId, sessions: summaries };
    } catch (error) {
      this.logger.warn(
        `Failed to enumerate telemetry sessions: ${(error as Error).message}`,
      );
      const fallback = await this.getSessionTimeline(this.currentSessionId, {
        eventLimit: 0,
      });
      return {
        current: this.currentSessionId,
        sessions: [
          {
            id: this.currentSessionId,
            sessionStart: fallback.sessionStart,
            sessionEnd: fallback.sessionEnd,
            sessionDurationMs: fallback.sessionDurationMs,
          },
        ],
      };
    }
  }

  async recordClick(
    target: { x: number; y: number },
    actual: { x: number; y: number },
    context: ClickContextMeta = {},
    adjusted?: { x: number; y: number },
  ): Promise<void> {
    if (!this.telemetryEnabled) {
      return;
    }

    await this.ready;

    const delta = {
      x: actual.x - target.x,
      y: actual.y - target.y,
    };

    this.updateDrift(delta);

    const appName = await this.getActiveAppName();
    const payload: ClickTelemetryPayload & {
      app?: string;
      clickTaskId?: string;
    } = {
      target,
      adjusted,
      actual,
      delta,
      region: context.region,
      zoomLevel: context.zoomLevel,
      targetDescription: context.targetDescription,
      source: context.source,
      timestamp: new Date().toISOString(),
      app: appName || undefined,
      clickTaskId: context.clickTaskId,
    };

    try {
      await fs.appendFile(
        this.getLogFilePath(),
        JSON.stringify(payload) + '\n',
        'utf8',
      );
    } catch (error) {
      this.logger.warn(
        `Failed to append click telemetry: ${(error as Error).message}`,
      );
    }
  }

  async recordUntargetedClick(
    actual: { x: number; y: number },
    context: ClickContextMeta = {},
  ): Promise<void> {
    if (!this.telemetryEnabled) {
      return;
    }

    await this.ready;

    const appName = await this.getActiveAppName();
    const payload = {
      type: 'untargeted_click',
      actual,
      context,
      timestamp: new Date().toISOString(),
      app: appName || undefined,
    };

    try {
      await fs.appendFile(
        this.getLogFilePath(),
        JSON.stringify(payload) + '\n',
        'utf8',
      );
    } catch (error) {
      this.logger.warn(
        `Failed to append untargeted click telemetry: ${(error as Error).message}`,
      );
    }
  }

  private async getActiveAppName(): Promise<string | null> {
    try {
      // Try xprop via wmctrl -lx; pick the active window (marked with '*') if present
      const { stdout } = await exec('wmctrl -lx');
      const lines = stdout.split('\n').filter(Boolean);
      // Fallback: first non-empty line
      if (lines.length === 0) return null;
      // wmctrl doesn't mark active with '*'; parse class/name column
      // Format: 0x04600007  0 computer Navigator.firefox-esr   <title>
      const activeLine = lines[0];
      const parts = activeLine.trim().split(/\s+/);
      const clazz = parts[3] || '';
      return clazz;
    } catch {
      return null;
    }
  }

  async recordEvent(
    type: string,
    data: Record<string, any> = {},
  ): Promise<void> {
    if (!this.telemetryEnabled) return;
    await this.ready;
    const appName = await this.getActiveAppName();
    const payload = {
      type,
      ...data,
      app: appName || undefined,
      timestamp: new Date().toISOString(),
    };
    try {
      await fs.appendFile(
        this.getLogFilePath(),
        JSON.stringify(payload) + '\n',
        'utf8',
      );
    } catch (err) {
      this.logger.warn(
        `Failed to append event telemetry: ${(err as Error).message}`,
      );
    }
  }

  async storeCalibrationSnapshot(
    image: Buffer,
    meta: {
      target: { x: number; y: number };
      actual: { x: number; y: number };
      context?: ClickContextMeta;
    },
  ): Promise<void> {
    if (!this.isCalibrationEnabled()) {
      return;
    }

    await this.ready;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `calibration-${timestamp}.png`;
    const calibrationDir = this.getCalibrationDir();
    await fs.mkdir(calibrationDir, { recursive: true });
    const filePath = path.join(calibrationDir, fileName);

    try {
      await fs.writeFile(filePath, image);
      const payload = {
        type: 'calibration_snapshot',
        file: fileName,
        target: meta.target,
        actual: meta.actual,
        context: meta.context,
        timestamp: new Date().toISOString(),
      };
      await fs.appendFile(
        this.getLogFilePath(),
        JSON.stringify(payload) + '\n',
        'utf8',
      );
    } catch (error) {
      this.logger.warn(
        `Failed to persist calibration snapshot: ${(error as Error).message}`,
      );
    }
  }

  private updateDrift(delta: DriftOffset): void {
    if (!this.isDriftCompensationEnabled()) {
      return;
    }

    const alpha = Number.isFinite(this.smoothingFactor)
      ? this.smoothingFactor
      : 0.2;

    this.drift = {
      x: this.drift.x + alpha * (delta.x - this.drift.x),
      y: this.drift.y + alpha * (delta.y - this.drift.y),
    };

    void this.persistDrift();
  }

  private async persistDrift(): Promise<void> {
    try {
      await fs.writeFile(
        this.getDriftFilePath(),
        JSON.stringify(this.drift),
        'utf8',
      );
    } catch (error) {
      this.logger.warn(
        `Failed to persist drift offset: ${(error as Error).message}`,
      );
    }
  }

  async resetAll(sessionId?: string): Promise<void> {
    await this.ready;
    const normalized = this.normalizeSessionId(sessionId);
    const targetSession = normalized ?? this.currentSessionId;
    try {
      if (normalized) {
        await this.startSession(normalized);
      } else {
        await this.ensureSessionDirectories(targetSession);
      }
      const sessionDir = this.resolveSessionDir(targetSession);
      const driftFile = path.join(sessionDir, 'drift.json');
      const zeroDrift = { x: 0, y: 0 };
      await fs.writeFile(driftFile, JSON.stringify(zeroDrift), 'utf8');

      // Truncate click telemetry log
      const logFile = path.join(sessionDir, 'click-telemetry.log');
      await fs.writeFile(logFile, '', 'utf8');

      // Clear calibration snapshots
      try {
        const calibrationDir = path.join(sessionDir, 'calibration');
        const files = await fs.readdir(calibrationDir);
        await Promise.all(
          files.map((f) =>
            fs
              .unlink(path.join(calibrationDir, f))
              .catch(() => undefined),
          ),
        );
      } catch (error) {
        // Ignore cleanup failures when resetting calibration snapshots
      }

      if (targetSession === this.currentSessionId) {
        await this.loadDriftForSession(targetSession);
      }
    } catch (e) {
      this.logger.warn(`Failed to reset telemetry: ${(e as Error).message}`);
      // Do not rethrow; reset is best-effort
    }
  }

  private resolveSessionDir(sessionId?: string): string {
    const effectiveSession = sessionId || this.currentSessionId;
    return path.join(this.telemetryDir, effectiveSession);
  }

  private resolveLogFilePath(sessionId?: string): string {
    return path.join(this.resolveSessionDir(sessionId), 'click-telemetry.log');
  }

  private resolveCalibrationDir(sessionId?: string): string {
    return path.join(this.resolveSessionDir(sessionId), 'calibration');
  }

  private getDriftFilePath(sessionId?: string): string {
    return path.join(this.resolveSessionDir(sessionId), 'drift.json');
  }

  private async ensureSessionDirectories(sessionId: string): Promise<void> {
    const normalized = this.normalizeSessionId(sessionId);
    if (!normalized) {
      throw new InvalidSessionIdError(sessionId);
    }
    const sessionDir = this.resolveSessionDir(normalized);
    const calibrationDir = this.resolveCalibrationDir(normalized);
    const logFile = this.resolveLogFilePath(normalized);
    await fs.mkdir(sessionDir, { recursive: true });
    await fs.mkdir(calibrationDir, { recursive: true });
    try {
      await fs.access(logFile);
    } catch {
      await fs.writeFile(logFile, '', 'utf8');
    }
  }

  private async loadDriftForSession(sessionId: string): Promise<void> {
    const normalized = this.normalizeSessionId(sessionId);
    if (!normalized) {
      throw new InvalidSessionIdError(sessionId);
    }
    try {
      const driftRaw = await fs
        .readFile(this.getDriftFilePath(normalized), 'utf8')
        .catch(() => null);
      if (driftRaw) {
        const parsed = JSON.parse(driftRaw) as DriftOffset;
        if (
          typeof parsed.x === 'number' &&
          Number.isFinite(parsed.x) &&
          typeof parsed.y === 'number' &&
          Number.isFinite(parsed.y)
        ) {
          this.drift = parsed;
          return;
        }
      }
      this.drift = { x: 0, y: 0 };
    } catch (error) {
      this.logger.warn(
        `Failed to load drift for session ${normalized}: ${(error as Error).message}`,
      );
      this.drift = { x: 0, y: 0 };
    }
  }

  async getSessionTimeline(
    sessionId?: string,
    options?: { eventLimit?: number },
  ): Promise<SessionTimelineSummary> {
    await this.ready;
    const limitRaw = options?.eventLimit ?? 20;
    const eventLimit = Number.isFinite(limitRaw)
      ? Math.max(0, Math.min(Math.trunc(limitRaw), 100))
      : 20;
    const normalized = this.normalizeSessionId(sessionId);
    const logPath = this.resolveLogFilePath(normalized);
    const defaultSummary: SessionTimelineSummary = {
      sessionStart: null,
      sessionEnd: null,
      sessionDurationMs: null,
      events: [],
    };

    try {
      const content = await fs.readFile(logPath, 'utf8');
      if (!content.trim()) {
        return defaultSummary;
      }

      const lines = content.split('\n').filter(Boolean);
      const parsedEntries: Array<{
        type: string | null;
        timestamp: string | null;
        timestampMs: number | null;
        metadata?: Record<string, any>;
      }> = [];

      let sessionStart: { timestamp: string; ms: number } | null = null;
      let sessionEnd: { timestamp: string; ms: number } | null = null;

      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          const type = typeof obj?.type === 'string' ? obj.type : null;
          const ts = typeof obj?.timestamp === 'string' ? obj.timestamp : null;
          const ms = ts ? Date.parse(ts) : Number.NaN;
          const timestampMs = Number.isFinite(ms) ? ms : null;

          if (timestampMs !== null) {
            if (!sessionStart || timestampMs < sessionStart.ms) {
              sessionStart = { timestamp: ts!, ms: timestampMs };
            }
            if (!sessionEnd || timestampMs > sessionEnd.ms) {
              sessionEnd = { timestamp: ts!, ms: timestampMs };
            }
          }

          let metadata: Record<string, any> | undefined;
          if (type === 'action') {
            metadata = this.extractActionMetadata(obj);
          }

          parsedEntries.push({
            type,
            timestamp: ts,
            timestampMs,
            metadata,
          });
        } catch (error) {
          // ignore malformed log lines when building timeline summary
        }
      }

      const events: TelemetryActionEventSummary[] = [];
      if (eventLimit > 0) {
        for (let i = parsedEntries.length - 1; i >= 0; i--) {
          if (events.length >= eventLimit) {
            break;
          }
          const entry = parsedEntries[i];
          if (
            entry.type === 'action' &&
            entry.timestamp &&
            entry.metadata &&
            entry.timestampMs !== null
          ) {
            events.push({
              type: entry.type,
              timestamp: entry.timestamp,
              metadata: entry.metadata,
            });
          }
        }
        events.reverse();
      }

      const sessionDurationMs =
        sessionStart && sessionEnd ? sessionEnd.ms - sessionStart.ms : null;

      return {
        sessionStart: sessionStart?.timestamp ?? null,
        sessionEnd: sessionEnd?.timestamp ?? null,
        sessionDurationMs: sessionDurationMs !== null ? sessionDurationMs : null,
        events,
      };
    } catch (error) {
      return defaultSummary;
    }
  }

  private extractActionMetadata(entry: Record<string, any>): Record<string, any> {
    const metadata: Record<string, any> = {};
    for (const [key, value] of Object.entries(entry ?? {})) {
      if (key === 'type' || key === 'timestamp' || key === 'app') {
        continue;
      }
      metadata[key] = value;
    }
    return metadata;
  }
}
