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
});
