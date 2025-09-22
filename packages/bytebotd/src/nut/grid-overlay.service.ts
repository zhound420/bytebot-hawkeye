import { Injectable, Logger } from '@nestjs/common';

import { COORDINATE_SYSTEM_CONFIG } from '../config/coordinate-system.config';
import { OverlayDescriptor, ScreenshotAnnotator } from './screenshot-annotator';

export interface GridOverlayOptions {
  gridSize: number;
  lineColor: string;
  lineOpacity: number;
  textColor: string;
  textOpacity: number;
  fontSize: number;
  lineWidth: number;
  showGlobalCoords?: boolean;
  globalOffset?: { x: number; y: number };
}

@Injectable()
export class GridOverlayService {
  private readonly logger = new Logger(GridOverlayService.name);
  private readonly universalTeachingEnabled =
    COORDINATE_SYSTEM_CONFIG.universalTeaching;

  private readonly defaultOptions: GridOverlayOptions = {
    gridSize: 100, // Grid lines every 100 pixels
    lineColor: '#00FF00', // Bright green for visibility
    lineOpacity: 0.4, // Semi-transparent lines
    textColor: '#00FF00', // Bright green text
    textOpacity: 0.8, // More opaque text for readability
    fontSize: 12, // Font size for coordinate labels
    lineWidth: 1, // Line thickness
    showGlobalCoords: true,
    globalOffset: { x: 0, y: 0 },
  };

  /**
   * Adds a coordinate grid overlay to a screenshot buffer
   */
  createGridOverlay(
    width: number,
    height: number,
    options: Partial<GridOverlayOptions> = {},
  ): OverlayDescriptor | undefined {
    if (!width || !height) {
      return undefined;
    }

    if (!this.universalTeachingEnabled) {
      return undefined;
    }

    const opts = { ...this.defaultOptions, ...options };
    this.logger.debug(`Preparing grid overlay for ${width}x${height} image`);

    const svg = this.createGridSVG(width, height, opts);
    return {
      input: Buffer.from(svg),
      top: 0,
      left: 0,
    };
  }

  /**
   * Creates an SVG string with grid lines and coordinate labels
   */
  private createGridSVG(
    width: number,
    height: number,
    options: GridOverlayOptions,
  ): string {
    const {
      gridSize,
      lineColor,
      lineOpacity,
      textColor,
      textOpacity,
      fontSize,
      lineWidth,
      showGlobalCoords = true,
      globalOffset,
    } = options;

    const offsetX = globalOffset?.x ?? 0;
    const offsetY = globalOffset?.y ?? 0;

    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Add grid lines
    svgContent += `<g stroke="${lineColor}" stroke-opacity="${lineOpacity}" stroke-width="${lineWidth}" fill="none">`;

    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      svgContent += `<line x1="${x}" y1="0" x2="${x}" y2="${height}"/>`;
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      svgContent += `<line x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
    }

    svgContent += '</g>';

    // Add coordinate labels
    svgContent += `<g fill="${textColor}" fill-opacity="${textOpacity}" font-family="Arial, sans-serif" font-size="${fontSize}px" font-weight="bold">`;

    // X-axis labels (top of screen)
    for (let x = gridSize; x <= width; x += gridSize) {
      const label = showGlobalCoords ? x + offsetX : x;
      svgContent += `<text x="${x}" y="${fontSize + 2}" text-anchor="middle">${label}</text>`;
    }

    // Y-axis labels (left side of screen)
    for (let y = gridSize; y <= height; y += gridSize) {
      const label = showGlobalCoords ? y + offsetY : y;
      svgContent += `<text x="2" y="${y + fontSize / 2}" text-anchor="start">${label}</text>`;
    }

    // Add origin label
    if (showGlobalCoords) {
      svgContent += `<text x="2" y="${fontSize}" text-anchor="start" fill="${textColor}" fill-opacity="${Math.min(1, textOpacity + 0.2)}">${offsetX},${offsetY}</text>`;
      svgContent += `<text x="${width - 2}" y="${fontSize}" text-anchor="end" fill="${textColor}" fill-opacity="${textOpacity}">${offsetX + width},${offsetY}</text>`;
      svgContent += `<text x="2" y="${height - 2}" text-anchor="start" fill="${textColor}" fill-opacity="${textOpacity}">${offsetX},${offsetY + height}</text>`;
      svgContent += `<text x="${width - 2}" y="${height - 2}" text-anchor="end" fill="${textColor}" fill-opacity="${textOpacity}">${offsetX + width},${offsetY + height}</text>`;
    } else {
      svgContent += `<text x="2" y="${fontSize}" text-anchor="start" fill="${textColor}" fill-opacity="${Math.min(1, textOpacity + 0.2)}">0,0</text>`;
      svgContent += `<text x="${width - 2}" y="${fontSize}" text-anchor="end" fill="${textColor}" fill-opacity="${textOpacity}">${width},0</text>`;
      svgContent += `<text x="2" y="${height - 2}" text-anchor="start" fill="${textColor}" fill-opacity="${textOpacity}">0,${height}</text>`;
      svgContent += `<text x="${width - 2}" y="${height - 2}" text-anchor="end" fill="${textColor}" fill-opacity="${textOpacity}">${width},${height}</text>`;
    }

    svgContent += '</g>';
    svgContent += '</svg>';

    return svgContent;
  }

  /**
   * Creates a more subtle grid overlay for production use
   */
  createSubtleGridOverlay(
    width: number,
    height: number,
  ): OverlayDescriptor | undefined {
    if (!this.universalTeachingEnabled) {
      return undefined;
    }
    return this.createGridOverlay(width, height, {
      gridSize: 50,
      lineColor: '#FFFFFF',
      lineOpacity: 0.15,
      textColor: '#FFFFFF',
      textOpacity: 0.6,
      fontSize: 10,
      lineWidth: 1,
    });
  }

  /**
   * Creates a high-contrast grid overlay for debugging
   */
  createDebugGridOverlay(
    width: number,
    height: number,
  ): OverlayDescriptor | undefined {
    if (!this.universalTeachingEnabled) {
      return undefined;
    }
    return this.createGridOverlay(width, height, {
      gridSize: 100,
      lineColor: '#FF0000',
      lineOpacity: 0.8,
      textColor: '#FF0000',
      textOpacity: 1.0,
      fontSize: 14,
      lineWidth: 2,
    });
  }

  createGridForImage(
    width: number,
    height: number,
    options: {
      gridSize?: number;
      showGlobalCoords?: boolean;
      globalOffset?: { x: number; y: number };
    } = {},
  ): OverlayDescriptor | undefined {
    if (!this.universalTeachingEnabled) {
      return undefined;
    }
    return this.createGridOverlay(width, height, {
      gridSize: options.gridSize ?? this.defaultOptions.gridSize,
      showGlobalCoords: options.showGlobalCoords ?? true,
      globalOffset: options.globalOffset ?? { x: 0, y: 0 },
    });
  }

  createProgressOverlay(
    width: number,
    height: number,
    step: number,
    options: {
      message?: string;
      targetRegion?: string;
      highlightAllRegions?: boolean;
      frameImage?: boolean;
    } = {},
  ): OverlayDescriptor | undefined {
    if (!width || !height) {
      return undefined;
    }

    if (!this.universalTeachingEnabled) {
      return undefined;
    }

    const overlays: string[] = [];

    if (options.highlightAllRegions) {
      const regionWidth = width / 3;
      const regionHeight = height / 3;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          overlays.push(
            `<rect x="${col * regionWidth}" y="${row * regionHeight}" width="${regionWidth}" height="${regionHeight}" fill="none" stroke="rgba(76,175,80,0.45)" stroke-width="2" />`,
          );
        }
      }
    }

    if (options.frameImage) {
      overlays.push(
        `<rect x="2" y="2" width="${width - 4}" height="${height - 4}" fill="none" stroke="rgba(76,175,80,0.8)" stroke-width="3" />`,
      );
    }

    if (options.targetRegion && !options.frameImage) {
      const bounds = this.getRegionBounds(options.targetRegion, width, height);
      overlays.push(
        `<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" fill="none" stroke="#4CAF50" stroke-width="3" />`,
      );
    }

    const progressOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="10" width="360" height="90" rx="10" ry="10" fill="rgba(13,17,23,0.75)" />
        <text x="30" y="50" font-size="28" fill="#4CAF50" font-family="Arial, sans-serif">Step ${step}</text>
        <text x="30" y="78" font-size="18" fill="#c9d1d9" font-family="Arial, sans-serif">${
          options.message ?? 'Processing…'
        }</text>
        ${overlays.join('\n')}
      </svg>
    `;

    return {
      input: Buffer.from(progressOverlay),
      top: 0,
      left: 0,
    };
  }

  createCursorOverlay(
    width: number,
    height: number,
    coordinates: { x: number; y: number },
    options: {
      color?: string;
      lineLength?: number;
      lineWidth?: number;
      radius?: number;
    } = {},
  ): OverlayDescriptor | undefined {
    if (!width || !height) {
      return undefined;
    }

    if (!this.universalTeachingEnabled) {
      return undefined;
    }

    const x = Math.round(coordinates.x);
    const y = Math.round(coordinates.y);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return undefined;
    }

    if (x < 0 || x > width || y < 0 || y > height) {
      return undefined;
    }

    const {
      color = '#FF0000',
      lineLength = 20,
      lineWidth = 2,
      radius = 5,
    } = options;

    const horizontalStart = Math.max(0, x - lineLength);
    const horizontalEnd = Math.min(width, x + lineLength);
    const verticalStart = Math.max(0, y - lineLength);
    const verticalEnd = Math.min(height, y + lineLength);

    const cursorOverlay = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <line x1="${horizontalStart}" y1="${y}" x2="${horizontalEnd}" y2="${y}" stroke="${color}" stroke-width="${lineWidth}" />
        <line x1="${x}" y1="${verticalStart}" x2="${x}" y2="${verticalEnd}" stroke="${color}" stroke-width="${lineWidth}" />
        <circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" fill-opacity="0.6" stroke="${color}" stroke-width="${Math.max(
          1,
          lineWidth / 2,
        )}" />
      </svg>
    `;

    return {
      input: Buffer.from(cursorOverlay),
      top: 0,
      left: 0,
    };
  }

  async addGridOverlay(
    imageBuffer: Buffer,
    options: Partial<GridOverlayOptions> = {},
  ): Promise<Buffer> {
    if (!this.universalTeachingEnabled) {
      return imageBuffer;
    }
    const annotator = await ScreenshotAnnotator.from(imageBuffer);
    annotator.addOverlay(
      this.createGridOverlay(
        annotator.dimensions.width,
        annotator.dimensions.height,
        options,
      ),
    );
    const result = await annotator.render();
    if (!annotator.hasOverlays) {
      return imageBuffer;
    }
    return result.buffer;
  }

  async addSubtleGridOverlay(imageBuffer: Buffer): Promise<Buffer> {
    if (!this.universalTeachingEnabled) {
      return imageBuffer;
    }
    const annotator = await ScreenshotAnnotator.from(imageBuffer);
    annotator.addOverlay(
      this.createSubtleGridOverlay(
        annotator.dimensions.width,
        annotator.dimensions.height,
      ),
    );
    const result = await annotator.render();
    if (!annotator.hasOverlays) {
      return imageBuffer;
    }
    return result.buffer;
  }

  async addDebugGridOverlay(imageBuffer: Buffer): Promise<Buffer> {
    if (!this.universalTeachingEnabled) {
      return imageBuffer;
    }
    const annotator = await ScreenshotAnnotator.from(imageBuffer);
    annotator.addOverlay(
      this.createDebugGridOverlay(
        annotator.dimensions.width,
        annotator.dimensions.height,
      ),
    );
    const result = await annotator.render();
    if (!annotator.hasOverlays) {
      return imageBuffer;
    }
    return result.buffer;
  }

  async addGridToImage(
    imageBuffer: Buffer,
    options: {
      gridSize?: number;
      showGlobalCoords?: boolean;
      globalOffset?: { x: number; y: number };
    } = {},
  ): Promise<Buffer> {
    if (!this.universalTeachingEnabled) {
      return imageBuffer;
    }
    const annotator = await ScreenshotAnnotator.from(imageBuffer);
    annotator.addOverlay(
      this.createGridForImage(
        annotator.dimensions.width,
        annotator.dimensions.height,
        options,
      ),
    );
    const result = await annotator.render();
    if (!annotator.hasOverlays) {
      return imageBuffer;
    }
    return result.buffer;
  }

  async addProgressIndicators(
    imageBuffer: Buffer,
    step: number,
    options: {
      message?: string;
      targetRegion?: string;
      coordinates?: { x: number; y: number };
      highlightAllRegions?: boolean;
      frameImage?: boolean;
    } = {},
  ): Promise<Buffer> {
    if (!this.universalTeachingEnabled) {
      return imageBuffer;
    }
    const annotator = await ScreenshotAnnotator.from(imageBuffer);
    const { width, height } = annotator.dimensions;
    annotator.addOverlay(
      this.createProgressOverlay(width, height, step, {
        message: options.message,
        targetRegion: options.targetRegion,
        highlightAllRegions: options.highlightAllRegions,
        frameImage: options.frameImage,
      }),
    );
    if (options.coordinates) {
      annotator.addOverlay(
        this.createCursorOverlay(width, height, options.coordinates),
      );
    }
    const result = await annotator.render();
    if (!annotator.hasOverlays) {
      return imageBuffer;
    }
    return result.buffer;
  }

  async addCursorIndicator(
    imageBuffer: Buffer,
    coordinates: { x: number; y: number },
    options: {
      color?: string;
      lineLength?: number;
      lineWidth?: number;
      radius?: number;
    } = {},
  ): Promise<Buffer> {
    if (!this.universalTeachingEnabled) {
      return imageBuffer;
    }
    const annotator = await ScreenshotAnnotator.from(imageBuffer);
    annotator.addOverlay(
      this.createCursorOverlay(
        annotator.dimensions.width,
        annotator.dimensions.height,
        coordinates,
        options,
      ),
    );
    const result = await annotator.render();
    if (!annotator.hasOverlays) {
      return imageBuffer;
    }
    return result.buffer;
  }

  private getRegionBounds(
    region: string,
    width: number,
    height: number,
  ): { x: number; y: number; width: number; height: number } {
    const [vertical, horizontal] = region.split('-');
    const rowIndex =
      vertical === 'top'
        ? 0
        : vertical === 'middle'
          ? 1
          : vertical === 'bottom'
            ? 2
            : 1;
    const colIndex =
      horizontal === 'left'
        ? 0
        : horizontal === 'center'
          ? 1
          : horizontal === 'right'
            ? 2
            : 1;

    const regionWidth = width / 3;
    const regionHeight = height / 3;

    return {
      x: Math.round(colIndex * regionWidth),
      y: Math.round(rowIndex * regionHeight),
      width: Math.round(regionWidth),
      height: Math.round(regionHeight),
    };
  }
}
