import { Calibrator } from './calibrator';
import { CoordinateTeacher } from './coordinate-teacher';
import { CoordinateParser } from './coordinate-parser';
import { UniversalCoordinateRefiner } from './universal-refiner';

describe('UniversalCoordinateRefiner heuristics', () => {
  const zoomAnswer = JSON.stringify({
    global: { x: 64, y: 72 },
    confidence: 0.9,
    needsZoom: false,
  });

  const createRefiner = (fullAnswer: string, dimensions: { width: number; height: number }) => {
    const ai = {
      askAboutScreenshot: jest
        .fn()
        .mockResolvedValueOnce(fullAnswer)
        .mockResolvedValueOnce(zoomAnswer),
    } as any;

    const capture = {
      full: jest.fn().mockResolvedValue({
        image: 'placeholder',
        offset: null,
      }),
      zoom: jest.fn().mockResolvedValue({
        image: 'placeholder',
        offset: null,
        region: { x: 0, y: 0, width: 200, height: 200 },
        zoomLevel: 2,
      }),
    };

    const refiner = new UniversalCoordinateRefiner(
      ai,
      new CoordinateTeacher(),
      new CoordinateParser(),
      new Calibrator(),
      capture,
    );

    (refiner as any).getDimensions = jest.fn().mockReturnValue(dimensions);

    return { refiner, ai, capture };
  };

  it.each([
    {
      title: 'coordinates land on the 100 px grid intersections',
      fullAnswer: JSON.stringify({
        global: { x: 200, y: 300 },
        confidence: 0.5,
        needsZoom: false,
      }),
      dimensions: { width: 1000, height: 800 },
    },
    {
      title: 'coordinates fall outside the known dimensions',
      fullAnswer: JSON.stringify({
        global: { x: 920, y: 50 },
        confidence: 0.5,
        needsZoom: false,
      }),
      dimensions: { width: 800, height: 600 },
    },
    {
      title: 'coordinates use overly round 25 px multiples',
      fullAnswer: JSON.stringify({
        global: { x: 250, y: 475 },
        confidence: 0.5,
        needsZoom: false,
      }),
      dimensions: { width: 1000, height: 800 },
    },
  ])('forces a zoom step when $title', async ({ fullAnswer, dimensions }) => {
    const { refiner, capture, ai } = createRefiner(fullAnswer, dimensions);

    const result = await refiner.locate('Test button');

    expect(ai.askAboutScreenshot).toHaveBeenCalledTimes(2);
    expect(capture.zoom).toHaveBeenCalledTimes(1);
    expect(result.steps.some((step) => step.id === 'zoom-refine')).toBe(true);
    expect(result.steps[0].response.needsZoom).toBe(true);
  });
});
