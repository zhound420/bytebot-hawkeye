import {
  DecodedImage,
  detectClickableElement,
  detectVisualChange,
} from '../visual-feedback.helper';

describe('visual-feedback.helper', () => {
  it('detects significant visual changes near the provided coordinates', async () => {
    const before = createDecodedImage(5, 5, () => 50);
    const after = createDecodedImage(5, 5, (x, y) =>
      x === 2 && y === 2 ? 250 : 50,
    );

    const result = await detectVisualChange(
      {
        beforeImage: 'before',
        afterImage: 'after',
        center: { x: 2, y: 2 },
        radius: 1,
        threshold: 10,
      },
      async (image) => (image === 'before' ? before : after),
    );

    expect(result.changed).toBe(true);
    expect(result.diff).toBeGreaterThan(10);
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('returns unchanged when images are identical', async () => {
    const image = createDecodedImage(6, 6, (x, y) =>
      (x + y) % 2 === 0 ? 120 : 80,
    );

    const result = await detectVisualChange(
      {
        beforeImage: 'same',
        afterImage: 'same',
        center: { x: 3, y: 3 },
        radius: 2,
        threshold: 5,
      },
      async () => image,
    );

    expect(result.changed).toBe(false);
    expect(result.diff).toBe(0);
    expect(result.confidence).toBe(0);
  });

  it('infers a likely clickable target near the attempted location', async () => {
    const brightX = 7;
    const brightY = 5;
    const image = createDecodedImage(12, 12, (x, y) =>
      x === brightX && y === brightY ? 250 : 40,
    );

    const inferred = await detectClickableElement(
      {
        image: 'probe',
        coordinates: { x: 5, y: 5 },
        searchRadius: 4,
      },
      async () => image,
    );

    expect(inferred).not.toBeNull();
    expect(Math.abs(inferred!.x - brightX)).toBeLessThanOrEqual(1);
    expect(Math.abs(inferred!.y - brightY)).toBeLessThanOrEqual(1);
  });
});

function createDecodedImage(
  width: number,
  height: number,
  factory: (x: number, y: number) => number,
): DecodedImage {
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = clamp(factory(x, y), 0, 255);
      data[y * width + x] = value;
    }
  }
  return { width, height, data };
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}
