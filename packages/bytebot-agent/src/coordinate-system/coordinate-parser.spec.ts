import { CoordinateParser } from './coordinate-parser';

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
});
