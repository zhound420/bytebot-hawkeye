import { GridOverlayService } from './grid-overlay.service';
import {
  CoordinateMapping,
  ZoomOptions,
  ZoomScreenshotService,
} from './zoom-screenshot.service';

describe('ZoomScreenshotService - createZoomedGridSVG', () => {
  let service: ZoomScreenshotService;

  beforeEach(() => {
    service = new ZoomScreenshotService(new GridOverlayService());
  });

  it('renders zoom banner, region offsets, and transform examples', () => {
    const mapping: CoordinateMapping = {
      localToGlobal: (localX: number, localY: number) => ({
        x: 100 + localX / 4,
        y: 200 + localY / 4,
      }),
      globalToLocal: (globalX: number, globalY: number) => ({
        x: (globalX - 100) * 4,
        y: (globalY - 200) * 4,
      }),
      region: { x: 100, y: 200, width: 400, height: 300 },
      zoomLevel: 4,
    };

    const options: ZoomOptions = {
      enableGrid: true,
      gridSize: 50,
      showGlobalCoordinates: true,
      zoomLevel: mapping.zoomLevel,
    };

    const svg = (service as any).createZoomedGridSVG(
      400,
      300,
      mapping,
      options,
      1920,
      1080,
    ) as string;

    expect(svg).toContain('4X ZOOM');
    expect(svg).toContain('Region starts at (100,200)');
    expect(svg).toContain('Local(120,80) + Offset = Global(130,220)');
  });
});
