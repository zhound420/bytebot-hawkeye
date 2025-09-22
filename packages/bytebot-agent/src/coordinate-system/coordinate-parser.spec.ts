import {
  CoordinateParser,
  evaluateCoordinateSuspicion,
} from './coordinate-parser';

describe('CoordinateParser', () => {
  let parser: CoordinateParser;

  beforeEach(() => {
    parser = new CoordinateParser();
  });

  it('parses string valued global coordinates', () => {
    const { global } = parser.parse('{"global": {"x": "120", "y": "40"}}');

    expect(global).toEqual({ x: 120, y: 40 });
  });

  it('parses string valued alternative coordinate keys', () => {
    const payload = JSON.stringify({
      global: { globalX: '860.2px', globalY: '660.4' },
    });

    const { global } = parser.parse(payload);

    expect(global).toEqual({ x: 860, y: 660 });
  });

  it('normalizes string valued zoom regions', () => {
    const payload = JSON.stringify({
      zoom: {
        region: {
          x: '10.4',
          y: '20.6',
          width: '30.2',
          height: '40.8',
        },
      },
    });

    const { zoom } = parser.parse(payload);

    expect(zoom?.region).toEqual({ x: 10, y: 21, width: 30, height: 41 });
  });

  it('identifies coordinates aligned to 100 px intersections as suspicious', () => {
    const parsed = parser.parse('{"global":{"x":200,"y":300}}');

    const suspicion = evaluateCoordinateSuspicion(parsed, {
      dimensions: { width: 1000, height: 800 },
    });

    expect(suspicion.suspicious).toBe(true);
    expect(suspicion.reasons.join(' ')).toContain('100 px');
  });

  it('identifies coordinates outside the provided bounds as suspicious', () => {
    const parsed = parser.parse('{"global":{"x":1200,"y":50}}');

    const suspicion = evaluateCoordinateSuspicion(parsed, {
      dimensions: { width: 800, height: 600 },
    });

    expect(suspicion.suspicious).toBe(true);
    expect(suspicion.reasons.join(' ')).toContain('outside the known bounds');
  });

  it('identifies overly round multiples of 25 px as suspicious', () => {
    const parsed = parser.parse('{"global":{"x":250,"y":475}}');

    const suspicion = evaluateCoordinateSuspicion(parsed);

    expect(suspicion.suspicious).toBe(true);
    expect(suspicion.reasons.join(' ')).toContain('25 px');
  });

  it('keeps needsZoom false for explicit negative zoom phrases', () => {
    expect(parser.parse('No zoom needed near 100, 200').needsZoom).toBe(false);
    expect(parser.parse('zoom: false at (10, 20)').needsZoom).toBe(false);
    expect(parser.parse('zoom = 0 around 50x75').needsZoom).toBe(false);
  });

  it('sets needsZoom true when a positive cue remains', () => {
    expect(parser.parse('please zoom in on the target').needsZoom).toBe(true);
    expect(parser.parse('get closer to the subject').needsZoom).toBe(true);
  });

  it('prefers parenthetical coordinates over confidence metrics', () => {
    const { global } = parser.parse('Confidence: 0.92. Click at (500, 200).');

    expect(global).toEqual({ x: 500, y: 200 });
  });

  it('extracts labeled coordinate pairs over score values', () => {
    const { global } = parser.parse('Score 0.8 ⇒ coordinate 120, 64');

    expect(global).toEqual({ x: 120, y: 64 });
  });
});
