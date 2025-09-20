import * as sharp from 'sharp';
import { Injectable } from '@nestjs/common';
import { NutService } from './nut.service';
import { FOCUS_CONFIG } from '../config/focus-config';
import { ZoomScreenshotService } from './zoom-screenshot.service';

interface FocusRegionDefinition {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable()
export class FocusRegionService {
  constructor(
    private readonly nutService: NutService,
    private readonly zoomScreenshot: ZoomScreenshotService,
  ) {}

  // Add caching to avoid redundant screenshots
  private screenCache: { timestamp: number; buffer: Buffer } | null = null;

  async captureFocusedRegion(
    regionName: string,
    options: {
      gridSize?: number;
      enhance?: boolean;
      includeOffset?: boolean;
      zoomLevel?: number;
    } = {},
  ): Promise<{
    image: Buffer;
    offset: { x: number; y: number };
    region: FocusRegionDefinition;
    zoomLevel: number;
  }> {
    // Get full screenshot and real screen dimensions
    const fullScreenshot = await this.getScreenshot();
    const metadata = await sharp(fullScreenshot).metadata();
    const screenWidth = metadata.width ?? 1920;
    const screenHeight = metadata.height ?? 1080;

    const region = this.getRegionDefinition(regionName, screenWidth, screenHeight);
    if (!region) {
      throw new Error(`Unknown focus region: ${regionName}`);
    }

    const zoomLevel = options.zoomLevel ?? FOCUS_CONFIG.REGION_ZOOM_LEVEL;

    const { buffer } = await this.zoomScreenshot.captureRegion(
      fullScreenshot,
      region,
      {
        enableGrid: true,
        gridSize: options.gridSize ?? FOCUS_CONFIG.REGION_GRID_SIZE,
        showGlobalCoordinates: options.includeOffset ?? true,
        zoomLevel,
      },
    );

    const shouldEnhance = options.enhance ?? FOCUS_CONFIG.AUTO_ENHANCE;
    const finalImage = shouldEnhance ? await this.enhanceImage(buffer) : buffer;

    return {
      image: finalImage,
      offset: { x: region.x, y: region.y },
      region,
      zoomLevel,
    };
  }

  async captureCustomRegion(
    x: number,
    y: number,
    width: number,
    height: number,
    gridSize: number = FOCUS_CONFIG.FOCUSED_GRID_SIZE,
    zoomLevel: number = FOCUS_CONFIG.CUSTOM_REGION_ZOOM_LEVEL,
  ): Promise<{
    image: Buffer;
    offset: { x: number; y: number };
    region: FocusRegionDefinition;
    zoomLevel: number;
  }> {
    const fullScreenshot = await this.getScreenshot();

    const { buffer } = await this.zoomScreenshot.captureRegion(fullScreenshot, {
      x,
      y,
      width,
      height,
    }, {
      enableGrid: true,
      gridSize,
      showGlobalCoordinates: true,
      zoomLevel,
    });

    return {
      image: buffer,
      offset: { x, y },
      region: { x, y, width, height },
      zoomLevel,
    };
  }

  private async getScreenshot(): Promise<Buffer> {
    if (!FOCUS_CONFIG.CACHE_SCREENSHOTS) {
      return this.nutService.screendump();
    }

    const now = Date.now();

    if (
      this.screenCache &&
      now - this.screenCache.timestamp < FOCUS_CONFIG.CACHE_TTL_MS
    ) {
      return this.screenCache.buffer;
    }

    const buffer = await this.nutService.screendump();
    this.screenCache = { timestamp: now, buffer };
    return buffer;
  }

  async getAdaptiveGridSize(
    targetType: 'button' | 'text' | 'menu' | 'icon',
  ): Promise<number> {
    // Different targets need different precision
    const gridSizes: Record<string, number> = {
      button: 50,
      text: 25,
      menu: 40,
      icon: 20,
    };

    return gridSizes[targetType] ?? FOCUS_CONFIG.REGION_GRID_SIZE;
  }

  private async enhanceImage(buffer: Buffer): Promise<Buffer> {
    // Enhance contrast and sharpness for better visibility
    const sharpenAmount = Math.max(FOCUS_CONFIG.SHARPEN_AMOUNT, 0);

    let pipeline = sharp(buffer).normalise();

    if (sharpenAmount > 0) {
      pipeline = pipeline.sharpen(sharpenAmount);
    }

    return pipeline.toBuffer();
  }

  private getRegionDefinition(
    regionName: string,
    screenWidth: number,
    screenHeight: number,
  ): FocusRegionDefinition | null {
    const [vertical, horizontal] = regionName.split('-');
    if (!vertical || !horizontal) {
      return null;
    }

    const rowIndex = this.getRowIndex(vertical);
    const colIndex = this.getColumnIndex(horizontal);

    const xSegments = this.calculateSegments(screenWidth);
    const ySegments = this.calculateSegments(screenHeight);

    return {
      x: xSegments.start[colIndex],
      y: ySegments.start[rowIndex],
      width: xSegments.size[colIndex],
      height: ySegments.size[rowIndex],
    };
  }

  private calculateSegments(total: number): {
    start: [number, number, number];
    size: [number, number, number];
  } {
    const firstBoundary = Math.round(total / 3);
    const secondBoundary = Math.round((2 * total) / 3);

    const starts: [number, number, number] = [0, firstBoundary, secondBoundary];
    const sizes: [number, number, number] = [
      Math.max(firstBoundary, 1),
      Math.max(secondBoundary - firstBoundary, 1),
      Math.max(total - secondBoundary, 1),
    ];

    // Ensure coverage of the entire dimension
    sizes[1] = Math.max(secondBoundary - firstBoundary, 1);
    sizes[2] = Math.max(total - secondBoundary, 1);

    // Adjust final segment if rounding left a gap or overlap
    const covered = starts[2] + sizes[2];
    if (covered !== total) {
      sizes[2] = Math.max(total - starts[2], 1);
    }

    return { start: starts, size: sizes };
  }

  private getRowIndex(position: string): 0 | 1 | 2 {
    switch (position) {
      case 'top':
        return 0;
      case 'bottom':
        return 2;
      default:
        return 1;
    }
  }

  private getColumnIndex(position: string): 0 | 1 | 2 {
    switch (position) {
      case 'left':
        return 0;
      case 'right':
        return 2;
      default:
        return 1;
    }
  }
}
