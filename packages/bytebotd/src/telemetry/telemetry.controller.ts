import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
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
  }> {
    const logPath = this.telemetry.getLogFilePath(sessionId);
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

    try {
      const content = await fs.readFile(logPath, 'utf8');
      const lines = content.split('\n').filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        try {
          const obj = JSON.parse(line);
          if (app && obj.app && obj.app !== app) {
            continue;
          }
          if (obj.type === 'untargeted_click') {
            untargeted++;
          } else if (obj.target && obj.actual && obj.delta) {
            targeted++;
            const dx = Number(obj.delta.x) || 0;
            const dy = Number(obj.delta.y) || 0;
            sumDx += dx;
            sumDy += dy;
            sumAbs += Math.hypot(dx, dy);
            if (recentAbsDeltas.length < limit) {
              recentAbsDeltas.push(Math.hypot(dx, dy));
            }
          } else if (obj.type === 'retry_click') {
            retryClicks += Number(obj.attempts) || 1;
          } else if (obj.type === 'hover_probe') {
            const d = Number(obj.diff) || 0;
            hoverCount++;
            hoverSum += d;
          } else if (obj.type === 'post_click_diff') {
            const d = Number(obj.diff) || 0;
            postCount++;
            postSum += d;
          } else if (obj.type === 'action' && obj.name) {
            actionCounts.set(obj.name, (actionCounts.get(obj.name) || 0) + 1);
            if (
              obj.name === 'screenshot_region' ||
              obj.name === 'screenshot_custom_region'
            ) {
              progressiveZooms += 1;
            }
          } else if (
            obj.type === 'smart_click_complete' &&
            obj.success === true
          ) {
            // Only count smart click completions when they succeed.
            smartClicks += 1;
          } else if (obj.type === 'progressive_zoom') {
            progressiveZooms += 1;
          }
        } catch (error) {
          // Ignore malformed telemetry entries in summary parsing
        }
      }
    } catch (error) {
      // Ignore missing or unreadable telemetry log when building summary
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
    };
  }

  @Post('event')
  async event(@Body() body: any) {
    const type = typeof body?.type === 'string' ? body.type : 'custom';
    const data = body && typeof body === 'object' ? body : {};
    await this.telemetry.recordEvent(type, data);
    return { ok: true };
  }

  @Post('reset')
  async reset(@Query('session') sessionId?: string) {
    await this.telemetry.resetAll(sessionId);
    return { ok: true };
  }

  @Get('apps')
  async apps(
    @Query('limit') limitStr?: string,
    @Query('window') windowStr?: string,
    @Query('session') sessionId?: string,
  ): Promise<{ apps: Array<{ name: string; count: number }> }> {
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
  }

  @Get('sessions')
  async sessions(): Promise<{ sessions: string[] }> {
    const sessions = await this.telemetry.listSessions();
    return { sessions };
  }
}
