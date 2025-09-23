import { Calibrator } from './calibrator';
import { CalibrationMetrics } from './calibration-metrics';

describe('CalibrationMetrics', () => {
  it('summarises calibration attempts and convergence trend', () => {
    const calibrator = new Calibrator();

    // Create a mix of successful and unsuccessful samples across regions.
    for (let i = 0; i < 10; i++) {
      calibrator.recordCorrection(
        { x: 100 + i, y: 150 + i },
        { x: 100, y: 150 },
        {
          success: i % 2 === 0,
          error: i,
          predicted: { x: 100, y: 150 },
        },
      );
    }

    calibrator.recordSuccess(
      { x: 800, y: 600 },
      {
        success: true,
        error: 0,
        predicted: { x: 800, y: 600 },
      },
    );

    const metrics = new CalibrationMetrics(calibrator, {
      trendWindowSize: 6,
      hotspotLimit: 2,
      hotspotMinAttempts: 2,
      improvementThreshold: 0.01,
    });

    const snapshot = metrics.compute();

    expect(snapshot.totalAttempts).toBeGreaterThanOrEqual(11);
    expect(snapshot.successRate).toBeGreaterThan(0);
    expect(snapshot.averageError).toBeGreaterThan(0);
    expect(snapshot.currentWeightedOffset).not.toBeNull();

    expect(snapshot.convergenceTrend).toMatchObject({
      direction: expect.any(String),
      recentAverage: expect.any(Number),
    });

    expect(snapshot.regionalHotspots.length).toBeGreaterThan(0);
    const hotspot = snapshot.regionalHotspots[0];
    expect(hotspot.key).toEqual(expect.any(String));
    expect(hotspot.attempts).toBeGreaterThan(0);
    expect(hotspot.averageError).not.toBeNull();
  });

  it('supports metrics logging lifecycle', () => {
    jest.useFakeTimers();
    const calibrator = new Calibrator();
    calibrator.recordCorrection(
      { x: 15, y: 20 },
      { x: 10, y: 10 },
      { success: false, error: 12, predicted: { x: 10, y: 10 } },
    );

    const metrics = new CalibrationMetrics(calibrator);
    const logs: unknown[] = [];
    const stop = metrics.startMetricsLogging(10, (snapshot) => {
      logs.push(snapshot);
    });

    jest.advanceTimersByTime(35);
    stop();
    expect(logs.length).toBeGreaterThan(0);
    jest.useRealTimers();
  });
});
