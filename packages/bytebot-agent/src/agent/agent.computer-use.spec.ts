import { parseCoordinateResponse } from './agent.computer-use';

describe('parseCoordinateResponse', () => {
  it('parses JSON coordinate responses', () => {
    const result = parseCoordinateResponse('{"x": 10, "y": 20}');
    expect(result).toEqual({ x: 10, y: 20 });
  });

  it('prefers global coordinates when provided in parentheses', () => {
    const result = parseCoordinateResponse(
      'Coordinates: x=120(860), y=40(660)',
    );
    expect(result).toEqual({ x: 860, y: 660 });
  });

  it('prefers explicit global axis tokens when both local and global are present', () => {
    const result = parseCoordinateResponse(
      'local x=120 y=40; global x=860 y=660',
    );
    expect(result).toEqual({ x: 860, y: 660 });
  });

  it('parses coordinate pairs following a global label', () => {
    const result = parseCoordinateResponse(
      'Global coordinates are (860, 660) with local (120, 40)',
    );
    expect(result).toEqual({ x: 860, y: 660 });
  });
});
