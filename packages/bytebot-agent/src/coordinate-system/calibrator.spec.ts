import { Calibrator } from './calibrator';

describe('Calibrator', () => {
  it('returns zero offset when fewer than five samples exist', () => {
    const calibrator = new Calibrator();

    for (let i = 0; i < 4; i += 1) {
      calibrator.captureOffset({ x: 10, y: -5 }, 'test', { success: true });
    }

    expect(calibrator.getCurrentOffset()).toEqual({ x: 0, y: 0 });
  });

  it('weights recent successful samples more heavily', () => {
    const calibrator = new Calibrator();
    const samples = [
      { offset: { x: 60, y: 0 }, success: false },
      { offset: { x: 60, y: 0 }, success: false },
      { offset: { x: 60, y: 0 }, success: false },
      { offset: { x: 60, y: 0 }, success: false },
      { offset: { x: 0, y: 0 }, success: true },
      { offset: { x: 0, y: 0 }, success: true },
    ];

    samples.forEach(({ offset, success }) => {
      calibrator.captureOffset(offset, 'test', { success });
    });

    const expected = samples.slice(-50).reduce(
      (acc, sample, index, recent) => {
        const age = recent.length - index;
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

    const offset = calibrator.getCurrentOffset();

    expect(offset).not.toBeNull();
    expect(offset).toEqual({
      x: Math.round(expected.weighted.x / expected.totalWeight),
      y: Math.round(expected.weighted.y / expected.totalWeight),
    });
    expect(offset!.x).toBeLessThan(40);
  });

  it('falls back to the global offset when a region lacks samples', () => {
    const calibrator = new Calibrator();

    for (let i = 0; i < 6; i += 1) {
      calibrator.captureOffset({ x: 10, y: -5 }, 'global', { success: true });
    }

    const fallback = calibrator.getRegionalOffset({ x: 450, y: 180 });

    expect(fallback).toEqual({ x: 10, y: -5 });
  });

  it('uses the regional offset when enough samples exist', () => {
    const calibrator = new Calibrator();
    const regionPredicted = { x: 420, y: 210 };

    for (let i = 0; i < 5; i += 1) {
      calibrator.captureOffset({ x: 12, y: 12 }, 'global', { success: true });
    }

    for (let i = 0; i < 5; i += 1) {
      calibrator.recordCorrection(
        { x: regionPredicted.x - 6, y: regionPredicted.y + 4 },
        regionPredicted,
      );
    }

    for (let i = 0; i < 5; i += 1) {
      calibrator.captureOffset({ x: 14, y: 14 }, 'global', { success: true });
    }

    const globalOffset = calibrator.getCurrentOffset();
    const regionalOffset = calibrator.getRegionalOffset({ x: 430, y: 205 });

    expect(regionalOffset).toEqual({ x: -6, y: 4 });
    expect(regionalOffset).not.toEqual(globalOffset);
    expect(calibrator.apply({ x: 430, y: 205 })).toEqual({ x: 424, y: 209 });
  });
});
