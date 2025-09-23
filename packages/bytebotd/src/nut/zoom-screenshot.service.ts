import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import { GridOverlayService } from './grid-overlay.service';
import { COORDINATE_SYSTEM_CONFIG } from '../config/coordinate-system.config';

export interface RegionCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ZoomOptions {
  enableGrid: boolean;
  gridSize: number;
  showGlobalCoordinates: boolean;
  zoomLevel: number; // 1.0 = no zoom, 2.0 = 2x zoom, etc.
}

export interface CoordinateMapping {
  localToGlobal: (localX: number, localY: number) => { x: number; y: number };
  globalToLocal: (globalX: number, globalY: number) => { x: number; y: number };
  region: RegionCoordinates;
  zoomLevel: number;
}

@Injectable()
export class ZoomScreenshotService {
  private readonly logger = new Logger(ZoomScreenshotService.name);
  private readonly zoomRefinementEnabled =
    COORDINATE_SYSTEM_CONFIG.zoomRefinement;

  constructor(private readonly gridOverlayService: GridOverlayService) {}

  private readonly defaultZoomOptions: ZoomOptions = {
    enableGrid: this.zoomRefinementEnabled,
    gridSize: 50, // Smaller grid for zoomed regions
    showGlobalCoordinates: true,
    zoomLevel: 1.0,
  };

  /**
   * Captures a screenshot of a specific region and optionally applies zoom
   */
  async captureRegion(
    fullScreenBuffer: Buffer,
    region: RegionCoordinates,
    options: Partial<ZoomOptions> = {},
  ): Promise<{ buffer: Buffer; mapping: CoordinateMapping }> {
    try {
      const opts = { ...this.defaultZoomOptions, ...options };
      opts.enableGrid = opts.enableGrid && this.zoomRefinementEnabled;
      if (!this.zoomRefinementEnabled) {
        opts.zoomLevel = 1.0;
      }

      this.logger.debug(`Capturing region: ${region.x},${region.y} ${region.width}x${region.height}`);

      // Get full screen metadata
      const fullImage = sharp(fullScreenBuffer);
      const { width: fullWidth, height: fullHeight } = await fullImage.metadata();

      if (!fullWidth || !fullHeight) {
        throw new Error('Unable to determine full screen dimensions');
      }

      // Validate region bounds
      const validatedRegion = this.validateRegion(region, fullWidth, fullHeight);

      // Extract the region
      let regionBuffer = await fullImage
        .extract({
          left: validatedRegion.x,
          top: validatedRegion.y,
          width: validatedRegion.width,
          height: validatedRegion.height,
        })
        .png()
        .toBuffer();

      // Apply zoom if requested
      if (opts.zoomLevel !== 1.0) {
        const zoomedWidth = Math.round(validatedRegion.width * opts.zoomLevel);
        const zoomedHeight = Math.round(validatedRegion.height * opts.zoomLevel);

        regionBuffer = await sharp(regionBuffer)
          .resize(zoomedWidth, zoomedHeight, {
            kernel: sharp.kernel.lanczos3, // High-quality scaling
          })
          .png()
          .toBuffer();

        this.logger.debug(`Applied ${opts.zoomLevel}x zoom: ${validatedRegion.width}x${validatedRegion.height} → ${zoomedWidth}x${zoomedHeight}`);
      }

      // Create coordinate mapping
      const mapping: CoordinateMapping = {
        localToGlobal: (localX: number, localY: number) => {
          // Account for zoom level
          const unzoomedX = localX / opts.zoomLevel;
          const unzoomedY = localY / opts.zoomLevel;

          return {
            x: validatedRegion.x + unzoomedX,
            y: validatedRegion.y + unzoomedY,
          };
        },
        globalToLocal: (globalX: number, globalY: number) => {
          const localX = (globalX - validatedRegion.x) * opts.zoomLevel;
          const localY = (globalY - validatedRegion.y) * opts.zoomLevel;

          return { x: localX, y: localY };
        },
        region: validatedRegion,
        zoomLevel: opts.zoomLevel,
      };

      // Add grid overlay with coordinate mapping
      if (opts.enableGrid) {
        regionBuffer = await this.addZoomedGridOverlay(
          regionBuffer,
          mapping,
          opts,
          fullWidth,
          fullHeight,
        );
      }

      this.logger.debug('Region capture completed successfully');
      return { buffer: regionBuffer, mapping };

    } catch (error) {
      this.logger.error(`Error capturing region: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Adds grid overlay to zoomed region with both local and global coordinate labels
   */
  private async addZoomedGridOverlay(
    regionBuffer: Buffer,
    mapping: CoordinateMapping,
    options: ZoomOptions,
    fullWidth: number,
    fullHeight: number,
  ): Promise<Buffer> {
    try {
      const image = sharp(regionBuffer);
      const { width, height } = await image.metadata();

      if (!width || !height) {
        throw new Error('Unable to determine region dimensions');
      }

      // Create specialized SVG for zoomed region
      const svg = this.createZoomedGridSVG(
        width,
        height,
        mapping,
        options,
        fullWidth,
        fullHeight,
      );

      // Composite the grid overlay
      const result = await image
        .composite([
          {
            input: Buffer.from(svg),
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();

      return result;
    } catch (error) {
      this.logger.warn(`Failed to add zoomed grid overlay: ${error.message}`);
      return regionBuffer; // Return original on error
    }
  }

  /**
   * Creates SVG grid with dual coordinate system (local + global)
   */
  private createZoomedGridSVG(
    width: number,
    height: number,
    mapping: CoordinateMapping,
    options: ZoomOptions,
    fullWidth: number,
    fullHeight: number,
  ): string {
    const { gridSize, showGlobalCoordinates } = options;
    const lineColor = '#00FFFF'; // Cyan for zoomed regions
    const lineOpacity = 0.4;
    const textColor = '#00FFFF';
    const textOpacity = 0.9;
    const fontSize = 10;
    const lineWidth = 1;

    const bannerY = fontSize * 3;
    const regionInfoY = bannerY + fontSize * 1.5;
    const transformInfoY = regionInfoY + fontSize * 1.5;
    const xLabelBaseline = bannerY - fontSize * 0.5;

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

    // X-axis labels (showing both local and global coordinates)
    for (let x = gridSize; x <= width; x += gridSize) {
      const globalCoords = mapping.localToGlobal(x, 0);
      const label = showGlobalCoordinates
        ? `${Math.round(globalCoords.x)} (local ${x})`
        : `${x}`;
      svgContent += `<text x="${x}" y="${xLabelBaseline}" text-anchor="middle" dominant-baseline="middle" transform="rotate(-90 ${x} ${xLabelBaseline})">${label}</text>`;
    }

    // Y-axis labels (showing both local and global coordinates)
    for (let y = gridSize; y <= height; y += gridSize) {
      const globalCoords = mapping.localToGlobal(0, y);
      const label = showGlobalCoordinates
        ? `${Math.round(globalCoords.y)} (local ${y})`
        : `${y}`;
      svgContent += `<text x="2" y="${y + fontSize/2}" text-anchor="start">${label}</text>`;
    }

    // Add corner labels with zoom info
    const topLeftGlobal = mapping.localToGlobal(0, 0);
    const bottomRightGlobal = mapping.localToGlobal(width, height);

    svgContent += `<text x="2" y="${fontSize}" text-anchor="start" fill="${textColor}" fill-opacity="1.0">0,0 → (${Math.round(topLeftGlobal.x)},${Math.round(topLeftGlobal.y)})</text>`;
    svgContent += `<text x="${width - 2}" y="${fontSize}" text-anchor="end" fill="${textColor}" fill-opacity="${textOpacity}">${width},0</text>`;
    svgContent += `<text x="2" y="${height - 2}" text-anchor="start" fill="${textColor}" fill-opacity="${textOpacity}">0,${height}</text>`;
    svgContent += `<text x="${width - 2}" y="${height - 2}" text-anchor="end" fill="${textColor}" fill-opacity="${textOpacity}">${width},${height} → (${Math.round(bottomRightGlobal.x)},${Math.round(bottomRightGlobal.y)})</text>`;

    // Add zoom level indicator
    svgContent += `<text x="${width/2}" y="${fontSize + 2}" text-anchor="middle" fill="${textColor}" fill-opacity="1.0" font-size="${fontSize + 2}px">ZOOM: ${mapping.zoomLevel}x | REGION: ${mapping.region.width}×${mapping.region.height}</text>`;

    const zoomBannerLabel = `${mapping.zoomLevel.toFixed(0)}X ZOOM`;
    const regionStartLabel = `Region starts at (${Math.round(mapping.region.x)},${Math.round(mapping.region.y)})`;
    const sampleLocalPoint = { x: 120, y: 80 };
    const sampleGlobalPoint = mapping.localToGlobal(
      sampleLocalPoint.x,
      sampleLocalPoint.y,
    );
    const transformExampleLabel = `Local(${sampleLocalPoint.x},${sampleLocalPoint.y}) + Offset = Global(${Math.round(sampleGlobalPoint.x)},${Math.round(sampleGlobalPoint.y)})`;

    svgContent += `<text x="${width / 2}" y="${bannerY}" text-anchor="middle" fill="${textColor}" fill-opacity="1.0" font-size="${fontSize + 8}px">${zoomBannerLabel}</text>`;
    svgContent += `<text x="${width / 2}" y="${regionInfoY}" text-anchor="middle" fill="${textColor}" fill-opacity="${textOpacity}" font-size="${fontSize + 2}px">${regionStartLabel}</text>`;
    svgContent += `<text x="${width / 2}" y="${transformInfoY}" text-anchor="middle" fill="${textColor}" fill-opacity="${textOpacity}" font-size="${fontSize + 2}px">${transformExampleLabel}</text>`;

    svgContent += '</g>';
    svgContent += '</svg>';

    return svgContent;
  }

  /**
   * Validates and adjusts region to stay within screen bounds
   */
  private validateRegion(
    region: RegionCoordinates,
    screenWidth: number,
    screenHeight: number,
  ): RegionCoordinates {
    const validated = { ...region };

    // Ensure region starts within screen bounds
    validated.x = Math.max(0, Math.min(validated.x, screenWidth - 1));
    validated.y = Math.max(0, Math.min(validated.y, screenHeight - 1));

    // Ensure region doesn't exceed screen bounds
    validated.width = Math.min(validated.width, screenWidth - validated.x);
    validated.height = Math.min(validated.height, screenHeight - validated.y);

    // Ensure minimum region size
    validated.width = Math.max(100, validated.width);
    validated.height = Math.max(100, validated.height);

    if (validated.x !== region.x || validated.y !== region.y ||
        validated.width !== region.width || validated.height !== region.height) {
      this.logger.warn(`Region adjusted: ${region.x},${region.y} ${region.width}x${region.height} → ${validated.x},${validated.y} ${validated.width}x${validated.height}`);
    }

    return validated;
  }

  /**
   * Smart region detection based on common UI patterns
   */
  async createSmartRegions(fullScreenBuffer: Buffer): Promise<RegionCoordinates[]> {
    try {
      const image = sharp(fullScreenBuffer);
      const { width, height } = await image.metadata();

      if (!width || !height) {
        throw new Error('Unable to determine screen dimensions');
      }

      // Define common regions for progressive zoom
      const regions: RegionCoordinates[] = [
        // Top-left quadrant (common for menus, toolbars)
        { x: 0, y: 0, width: Math.floor(width / 2), height: Math.floor(height / 2) },

        // Top-right quadrant (common for buttons, controls)
        { x: Math.floor(width / 2), y: 0, width: Math.floor(width / 2), height: Math.floor(height / 2) },

        // Bottom-left quadrant (common for status bars, navigation)
        { x: 0, y: Math.floor(height / 2), width: Math.floor(width / 2), height: Math.floor(height / 2) },

        // Bottom-right quadrant (common for scroll bars, content)
        { x: Math.floor(width / 2), y: Math.floor(height / 2), width: Math.floor(width / 2), height: Math.floor(height / 2) },

        // Center region (common for main content)
        {
          x: Math.floor(width * 0.25),
          y: Math.floor(height * 0.25),
          width: Math.floor(width * 0.5),
          height: Math.floor(height * 0.5)
        },

        // Top strip (common for title bars, tabs)
        { x: 0, y: 0, width: width, height: Math.floor(height * 0.3) },

        // Bottom strip (common for status bars, taskbars)
        { x: 0, y: Math.floor(height * 0.7), width: width, height: Math.floor(height * 0.3) },
      ];

      return regions;
    } catch (error) {
      this.logger.error(`Error creating smart regions: ${error.message}`);
      // Fallback to simple quadrants
      return [
        { x: 0, y: 0, width: 640, height: 480 },
        { x: 640, y: 0, width: 640, height: 480 },
        { x: 0, y: 480, width: 640, height: 480 },
        { x: 640, y: 480, width: 640, height: 480 },
      ];
    }
  }

  /**
   * Helper method to find the best region containing a target point
   */
  findRegionContaining(
    targetX: number,
    targetY: number,
    regions: RegionCoordinates[],
  ): RegionCoordinates | null {
    for (const region of regions) {
      if (
        targetX >= region.x &&
        targetX < region.x + region.width &&
        targetY >= region.y &&
        targetY < region.y + region.height
      ) {
        return region;
      }
    }
    return null;
  }
}