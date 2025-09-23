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
  includeUniversalElements?: boolean;
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
    includeUniversalElements: true,
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
      textOpacity,
      lineWidth,
      showGlobalCoords = true,
      globalOffset,
      includeUniversalElements = true,
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
    svgContent += `<g font-family="Arial, sans-serif">`;

    const rulerFontSize = 12;
    const rulerColor = '#00FF00';

    // X-axis labels (top of screen)
    for (let x = 0; x <= width; x += gridSize) {
      const label = showGlobalCoords ? x + offsetX : x;
      const clampedX = Math.min(width - 2, Math.max(2, x));
      svgContent += `<text x="${clampedX}" y="${rulerFontSize + 6}" font-size="${rulerFontSize}px" font-weight="normal" fill="${rulerColor}" fill-opacity="${textOpacity}" text-anchor="middle" dominant-baseline="hanging">${label}</text>`;
    }

    // Y-axis labels (left side of screen) rotated -90 degrees
    for (let y = 0; y <= height; y += gridSize) {
      const label = showGlobalCoords ? y + offsetY : y;
      const pivotY = Math.min(height - 24, Math.max(24, y));
      svgContent += `<text x="20" y="${pivotY}" font-size="${rulerFontSize}px" font-weight="normal" fill="${rulerColor}" fill-opacity="${textOpacity}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 20 ${pivotY})">${label}</text>`;
    }

    svgContent += '</g>';

    if (includeUniversalElements) {
      svgContent += this.addUniversalTeachingElements(width, height, options);
    }

    svgContent += '</svg>';

    return svgContent;
  }

  private drawArrow(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    options: { color?: string; strokeWidth?: number; headLength?: number; headAngle?: number } = {},
  ): string {
    const color = options.color ?? '#00FF00';
    const strokeWidth = options.strokeWidth ?? 2;
    const headLength = options.headLength ?? 20;
    const headAngle = options.headAngle ?? Math.PI / 7;

    const angle = Math.atan2(endY - startY, endX - startX);
    const arrowLeftX = endX - headLength * Math.cos(angle - headAngle);
    const arrowLeftY = endY - headLength * Math.sin(angle - headAngle);
    const arrowRightX = endX - headLength * Math.cos(angle + headAngle);
    const arrowRightY = endY - headLength * Math.sin(angle + headAngle);

    return `
      <g stroke="${color}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" />
        <line x1="${arrowLeftX}" y1="${arrowLeftY}" x2="${endX}" y2="${endY}" />
        <line x1="${arrowRightX}" y1="${arrowRightY}" x2="${endX}" y2="${endY}" />
      </g>
    `;
  }

  private addUniversalTeachingElements(
    width: number,
    height: number,
    options: GridOverlayOptions,
    renderOptions: { wrap?: boolean } = {},
  ): string {
    if (!this.universalTeachingEnabled) {
      return '';
    }

    const { wrap = false } = renderOptions;
    const { showGlobalCoords = true, globalOffset } = options;

    const offsetX = globalOffset?.x ?? 0;
    const offsetY = globalOffset?.y ?? 0;

    const formatCoordinates = (x: number, y: number): string => {
      if (showGlobalCoords) {
        return `(${offsetX + x},${offsetY + y})`;
      }
      return `(${x},${y})`;
    };

    const clampedWidth = Math.max(0, Math.round(width));
    const clampedHeight = Math.max(0, Math.round(height));

    const cornerPadding = 12;
    const topY = Math.max(cornerPadding + 8, 0 + cornerPadding + 8);
    const bottomY = Math.max(cornerPadding, clampedHeight - cornerPadding);
    const leftX = Math.max(cornerPadding, 12);
    const rightX = Math.max(cornerPadding, clampedWidth - cornerPadding);

    const cornerLabels = [
      `<text x="${leftX}" y="${topY}" text-anchor="start" dominant-baseline="hanging" font-size="18px" font-weight="bold" fill="#FF0000" stroke="#FFFFFF" stroke-width="2" paint-order="stroke fill">${formatCoordinates(0, 0)}</text>`,
      `<text x="${rightX}" y="${topY}" text-anchor="end" dominant-baseline="hanging" font-size="18px" font-weight="bold" fill="#FF0000" stroke="#FFFFFF" stroke-width="2" paint-order="stroke fill">${formatCoordinates(clampedWidth, 0)}</text>`,
      `<text x="${leftX}" y="${bottomY}" text-anchor="start" dominant-baseline="baseline" font-size="18px" font-weight="bold" fill="#FF0000" stroke="#FFFFFF" stroke-width="2" paint-order="stroke fill">${formatCoordinates(0, clampedHeight)}</text>`,
      `<text x="${rightX}" y="${bottomY}" text-anchor="end" dominant-baseline="baseline" font-size="18px" font-weight="bold" fill="#FF0000" stroke="#FFFFFF" stroke-width="2" paint-order="stroke fill">${formatCoordinates(clampedWidth, clampedHeight)}</text>`,
    ].join('');

    const centerX = Math.round(clampedWidth / 2);
    const centerY = Math.round(clampedHeight / 2);

    const shortestSide = Math.max(1, Math.min(clampedWidth, clampedHeight));
    const outerRadius = Math.min(24, Math.max(10, Math.round(shortestSide * 0.02)));
    const innerRadius = Math.max(4, Math.round(outerRadius / 3));

    const horizontalMargin = Math.min(120, Math.round(clampedWidth * 0.1));
    const verticalMargin = Math.min(120, Math.round(clampedHeight * 0.1));

    const rawArrowStartX = Math.min(clampedWidth - horizontalMargin, Math.round(clampedWidth * 0.75));
    const arrowStartX = Math.min(
      clampedWidth - Math.max(16, Math.round(horizontalMargin / 3)),
      Math.max(centerX + Math.min(60, horizontalMargin), rawArrowStartX),
    );

    const rawArrowStartY = Math.max(verticalMargin, Math.round(clampedHeight * 0.25));
    const arrowStartY = Math.min(clampedHeight - verticalMargin, rawArrowStartY);

    const arrowHeadLength = Math.min(30, Math.max(14, Math.round(shortestSide * 0.05)));
    const arrowSvg = this.drawArrow(arrowStartX, arrowStartY, centerX, centerY, {
      color: '#00FF00',
      strokeWidth: 2,
      headLength: arrowHeadLength,
      headAngle: Math.PI / 7,
    });

    const bullseye = `
      <g stroke="#00FF00" stroke-width="2" fill="none">
        <circle cx="${centerX}" cy="${centerY}" r="${outerRadius}" />
        <circle cx="${centerX}" cy="${centerY}" r="${innerRadius}" />
      </g>
    `;

    const exampleAnchor = arrowStartX > centerX ? 'end' : 'start';
    const exampleLabelX = exampleAnchor === 'end' ? arrowStartX - 12 : arrowStartX + 12;
    const exampleLabelY = Math.max(28, arrowStartY - 16);
    const exampleCoordinates = formatCoordinates(centerX, centerY);
    const exampleLabel = `
      <text x="${exampleLabelX}" y="${exampleLabelY}" font-size="14px" font-weight="bold" fill="#00FF00" stroke="#000000" stroke-width="1" paint-order="stroke fill" text-anchor="${exampleAnchor}" dominant-baseline="baseline">
        Example: ${exampleCoordinates}
      </text>
    `;

    const formulaY = Math.max(28, clampedHeight - 16);
    const formula = `
      <text x="${centerX}" y="${formulaY}" font-size="14px" font-weight="bold" fill="#FFFFFF" stroke="#000000" stroke-width="1" paint-order="stroke fill" text-anchor="middle" dominant-baseline="baseline">
        X=horizontal(→), Y=vertical(↓)
      </text>
    `;

    const elements = [
      '<g font-family="Arial, sans-serif">',
      cornerLabels,
      exampleLabel,
      formula,
      '</g>',
      arrowSvg,
      bullseye,
    ].join('');

    if (wrap) {
      return `<svg width="${clampedWidth}" height="${clampedHeight}" xmlns="http://www.w3.org/2000/svg">${elements}</svg>`;
    }

    return elements;
  }

  private async applyGridOverlay(
    imageBuffer: Buffer,
    options: Partial<GridOverlayOptions> = {},
  ): Promise<Buffer> {
    const annotator = await ScreenshotAnnotator.from(imageBuffer);
    const { width, height } = annotator.dimensions;

    if (!width || !height) {
      return imageBuffer;
    }

    const includeUniversalElements =
      options.includeUniversalElements ?? this.defaultOptions.includeUniversalElements ?? true;

    const baseOptions: GridOverlayOptions = {
      ...this.defaultOptions,
      ...options,
      includeUniversalElements,
    };

    const gridOverlay = this.createGridOverlay(width, height, {
      ...baseOptions,
      includeUniversalElements: false,
    });

    if (gridOverlay) {
      annotator.addOverlay(gridOverlay);

      if (includeUniversalElements) {
        const teachingSvg = this.addUniversalTeachingElements(width, height, baseOptions, {
          wrap: true,
        });

        if (teachingSvg) {
          annotator.addOverlay({
            input: Buffer.from(teachingSvg),
            top: 0,
            left: 0,
          });
        }
      }
    }

    const result = await annotator.render();
    if (!annotator.hasOverlays) {
      return imageBuffer;
    }

    return result.buffer;
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
    return this.applyGridOverlay(imageBuffer, options);
  }

  async addSubtleGridOverlay(imageBuffer: Buffer): Promise<Buffer> {
    if (!this.universalTeachingEnabled) {
      return imageBuffer;
    }
    return this.applyGridOverlay(imageBuffer, {
      gridSize: 50,
      lineColor: '#FFFFFF',
      lineOpacity: 0.15,
      textColor: '#FFFFFF',
      textOpacity: 0.6,
      fontSize: 10,
      lineWidth: 1,
    });
  }

  async addDebugGridOverlay(imageBuffer: Buffer): Promise<Buffer> {
    if (!this.universalTeachingEnabled) {
      return imageBuffer;
    }
    return this.applyGridOverlay(imageBuffer, {
      gridSize: 100,
      lineColor: '#FF0000',
      lineOpacity: 0.8,
      textColor: '#FF0000',
      textOpacity: 1.0,
      fontSize: 14,
      lineWidth: 2,
    });
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
    return this.applyGridOverlay(imageBuffer, {
      gridSize: options.gridSize ?? this.defaultOptions.gridSize,
      showGlobalCoords: options.showGlobalCoords ?? true,
      globalOffset: options.globalOffset ?? { x: 0, y: 0 },
    });
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
