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
});
