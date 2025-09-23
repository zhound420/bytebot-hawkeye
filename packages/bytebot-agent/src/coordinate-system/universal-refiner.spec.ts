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

  const createRefiner = (
    fullAnswer: string,
    dimensions: { width: number; height: number },
    calibrator: Calibrator = new Calibrator(),
  ) => {
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
      calibrator,
      capture,
    );

    (refiner as any).getDimensions = jest.fn().mockReturnValue(dimensions);

    return { refiner, ai, capture, calibrator };
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

    const prompt = result.steps[0].prompt;
    expect(prompt).toContain('Corner callouts show');
    expect(prompt).toContain('Lime rulers mark every 100px along the top');
    expect(prompt).toContain('Grid lines span the frame every interval');
    expect(prompt).toContain('System will compensate');
    expect(prompt).not.toContain('example');
    expect(prompt).not.toContain('Reminder banner');

    expect(ai.askAboutScreenshot).toHaveBeenCalledTimes(2);
    expect(capture.zoom).toHaveBeenCalledTimes(1);
    expect(result.steps.some((step) => step.id === 'zoom-refine')).toBe(true);
    expect(result.steps[0].response.needsZoom).toBe(true);
  });

  it('does not treat screenshot offsets as drift without corrections', async () => {
    const calibrator = new Calibrator();
    const cycles = 12;
    const baseGlobal = { x: 420, y: 360 };

    const ai = { askAboutScreenshot: jest.fn() };
    const capture = {
      full: jest.fn(),
      zoom: jest.fn(),
    };

    for (let i = 0; i < cycles; i += 1) {
      ai.askAboutScreenshot.mockResolvedValueOnce(
        JSON.stringify({
          global: null,
          needsZoom: true,
        }),
      );
      ai.askAboutScreenshot.mockResolvedValueOnce(
        JSON.stringify({
          global: baseGlobal,
          confidence: 0.9,
        }),
      );

      capture.full.mockResolvedValueOnce({
        image: 'placeholder',
        offset: { x: 15 + i, y: -12 - i },
      });
      capture.zoom.mockResolvedValueOnce({
        image: 'placeholder',
        offset: { x: -7 - i, y: 9 + i },
        region: { x: 0, y: 0, width: 200, height: 200 },
        zoomLevel: 2,
      });
    }

    const refiner = new UniversalCoordinateRefiner(
      ai as any,
      new CoordinateTeacher(),
      new CoordinateParser(),
      calibrator,
      capture as any,
    );

    (refiner as any).getDimensions = jest
      .fn()
      .mockReturnValue({ width: 1920, height: 1080 });

    let result: any;
    for (let i = 0; i < cycles; i += 1) {
      result = await refiner.locate('Target button');
      expect(result.appliedOffset).toEqual({ x: 0, y: 0 });
      expect(result.coordinates).toEqual(baseGlobal);
    }

    expect(calibrator.getCurrentOffset()).toEqual({ x: 0, y: 0 });
    expect(result.calibrationHistory).toHaveLength(0);
  });

  it('uses the zoom region when center is not provided', async () => {
    const ai = {
      askAboutScreenshot: jest
        .fn()
        .mockResolvedValueOnce(
          JSON.stringify({
            global: null,
            needsZoom: true,
            zoom: {
              region: { x: 120, y: 240, width: 320, height: 180 },
            },
          }),
        )
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
        region: { x: 120, y: 240, width: 320, height: 180 },
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

    (refiner as any).getDimensions = jest
      .fn()
      .mockReturnValue({ width: 1920, height: 1080 });

    await refiner.locate('Target with region only');

    expect(capture.zoom).toHaveBeenCalledWith(
      expect.objectContaining({
        x: 120,
        y: 240,
        width: 320,
        height: 180,
      }),
    );
  });

  it('trims oversized zoom requests to the screenshot dimensions', async () => {
    const { refiner, capture } = createRefiner(
      JSON.stringify({
        global: null,
        needsZoom: true,
        zoom: {
          center: { x: 320, y: 240 },
          region: { x: 0, y: 0, width: 1024, height: 768 },
        },
      }),
      { width: 640, height: 480 },
    );

    await refiner.locate('Oversized region request');

    expect(capture.zoom).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 640,
        height: 480,
      }),
    );
  });

  it('derives zoom region size from radius when only center is provided', async () => {
    const radius = 320;
    const { refiner, capture } = createRefiner(
      JSON.stringify({
        global: null,
        needsZoom: true,
        zoom: {
          center: { x: 360, y: 260 },
          radius,
        },
      }),
      { width: 700, height: 500 },
    );

    await refiner.locate('Target with radius only');

    expect(capture.zoom).toHaveBeenCalledWith(
      expect.objectContaining({
        width: radius * 2,
        height: 500,
      }),
    );
  });

  it('clamps calibrated coordinates to the screenshot bounds', async () => {
    const baseGlobal = { x: 1503, y: 917 };
    const fullAnswer = JSON.stringify({
      global: baseGlobal,
      confidence: 0.95,
      needsZoom: false,
    });

    const calibrator = {
      recordTelemetry: jest.fn(),
      captureOffset: jest.fn(),
      getCurrentOffset: jest.fn().mockReturnValue({ x: 500, y: 300 }),
      apply: jest.fn().mockImplementation((coords) => ({
        x: coords.x + 500,
        y: coords.y + 300,
      })),
      getHistory: jest.fn().mockReturnValue([]),
    } as unknown as Calibrator;

    const { refiner, capture } = createRefiner(
      fullAnswer,
      { width: 1920, height: 1080 },
      calibrator,
    );

    const result = await refiner.locate('Clamped target');

    expect(capture.zoom).not.toHaveBeenCalled();
    expect(result.baseCoordinates).toEqual(baseGlobal);
    expect(result.coordinates).toEqual({ x: 1919, y: 1079 });
    expect(result.appliedOffset).toEqual({ x: 416, y: 162 });
  });
});
