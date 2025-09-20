import { extractSource } from './telemetry.controller';

describe('extractSource', () => {
  it('returns undefined when no source metadata is present', () => {
    expect(extractSource({ type: 'action', name: 'screenshot' })).toBeUndefined();
    expect(extractSource(null)).toBeUndefined();
  });

  it('prefers explicit metadata fields when available', () => {
    expect(extractSource({ source: 'progressive_zoom' })).toBe('progressive_zoom');
    expect(
      extractSource({ metadata: { source: 'progressive_zoom' } }),
    ).toBe('progressive_zoom');
    expect(
      extractSource({ context: { source: 'progressive_zoom' } }),
    ).toBe('progressive_zoom');
  });

  it('falls back to legacy progressive zoom entries without metadata', () => {
    expect(
      extractSource({ type: 'action', name: 'screenshot_region' }),
    ).toBe('progressive_zoom');
    expect(
      extractSource({ type: 'progressive_zoom', message: 'zoomed' }),
    ).toBe('progressive_zoom');
  });
});
