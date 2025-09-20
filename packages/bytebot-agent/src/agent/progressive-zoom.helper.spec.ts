import { ProgressiveZoomHelper } from './progressive-zoom.helper';

describe('ProgressiveZoomHelper smart regions', () => {
  const helper = new ProgressiveZoomHelper();
  const parseQuadrant = (helper as any).parseQuadrantResponse.bind(helper) as (
    response: string,
  ) => { region: string; confidence?: number; reason?: string } | null;
  const resolveRegion = (helper as any).resolveRegionBounds.bind(helper) as (
    name: string,
    width?: number,
    height?: number,
  ) => { x: number; y: number; width: number; height: number } | null;

  const screenWidth = 1920;
  const screenHeight = 1080;

  const calculateSegments = (total: number) => {
    const firstBoundary = Math.round(total / 3);
    const secondBoundary = Math.round((2 * total) / 3);

    const start: [number, number, number] = [0, firstBoundary, secondBoundary];
    const size: [number, number, number] = [
      Math.max(firstBoundary, 1),
      Math.max(secondBoundary - firstBoundary, 1),
      Math.max(total - secondBoundary, 1),
    ];

    size[1] = Math.max(secondBoundary - firstBoundary, 1);
    size[2] = Math.max(total - secondBoundary, 1);

    const covered = start[2] + size[2];
    if (covered !== total) {
      size[2] = Math.max(total - start[2], 1);
    }

    return { start, size };
  };

  const xSegments = calculateSegments(screenWidth);
  const ySegments = calculateSegments(screenHeight);

  const gridExpectations: Array<{
    name:
      | 'top-left'
      | 'top-center'
      | 'top-right'
      | 'middle-left'
      | 'middle-center'
      | 'middle-right'
      | 'bottom-left'
      | 'bottom-center'
      | 'bottom-right';
    row: 0 | 1 | 2;
    col: 0 | 1 | 2;
  }> = [
    { name: 'top-left', row: 0, col: 0 },
    { name: 'top-center', row: 0, col: 1 },
    { name: 'top-right', row: 0, col: 2 },
    { name: 'middle-left', row: 1, col: 0 },
    { name: 'middle-center', row: 1, col: 1 },
    { name: 'middle-right', row: 1, col: 2 },
    { name: 'bottom-left', row: 2, col: 0 },
    { name: 'bottom-center', row: 2, col: 1 },
    { name: 'bottom-right', row: 2, col: 2 },
  ];

  const expectedBounds = gridExpectations.reduce<Record<string, { x: number; y: number; width: number; height: number }>>(
    (acc, expectation) => {
      acc[expectation.name] = {
        x: xSegments.start[expectation.col],
        y: ySegments.start[expectation.row],
        width: xSegments.size[expectation.col],
        height: ySegments.size[expectation.row],
      };
      return acc;
    },
    {},
  );

  it('creates a 3x3 grid matching the daemon focus regions', () => {
    const regions = helper.createSmartRegions(screenWidth, screenHeight);
    for (const expectation of gridExpectations) {
      const match = regions.find(region => region.name === expectation.name);
      expect(match).toBeDefined();
      expect(match?.region).toEqual(expectedBounds[expectation.name]);
    }
  });

  it.each(gridExpectations)('resolves %s region bounds correctly', expectation => {
    const region = resolveRegion(expectation.name, screenWidth, screenHeight);
    expect(region).toEqual(expectedBounds[expectation.name]);
  });

  it.each(gridExpectations)('parses JSON responses for %s', expectation => {
    const response = JSON.stringify({ region: expectation.name, confidence: 0.9 });
    const parsed = parseQuadrant(response);
    expect(parsed).toEqual({ region: expectation.name, confidence: 0.9 });
  });

  it('parses textual responses referencing hyphenated regions', () => {
    const parsed = parseQuadrant('The button is clearly in the middle-right area of the grid.');
    expect(parsed).toEqual({ region: 'middle-right' });
  });
});
