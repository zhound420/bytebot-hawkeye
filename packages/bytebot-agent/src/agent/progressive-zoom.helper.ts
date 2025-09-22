import { Logger } from '@nestjs/common';
import { handleComputerToolUse, createSmartClickAI } from './agent.computer-use';
import {
  MessageContentType,
  ComputerToolUseContentBlock,
  ToolResultContentBlock,
  ClickContext,
} from '@bytebot/shared';
import { SmartClickAI } from './smart-click.helper';

export interface ProgressiveZoomConfig {
  maxZoomSteps: number;
  initialRegionSize: number;
  zoomFactor: number;
  confidenceThreshold: number;
}

export interface ZoomStep {
  step: number;
  region: { x: number; y: number; width: number; height: number };
  zoomLevel: number;
  screenshot: string;
  mapping?: any;
}

interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProgressiveZoomResult {
  success: boolean;
  finalCoordinates?: { x: number; y: number };
  steps: ZoomStep[];
  totalSteps: number;
  confidence: number;
}

export class ProgressiveZoomHelper {
  private readonly logger = new Logger(ProgressiveZoomHelper.name);
  private readonly zoomEnabled: boolean;
  private readonly smartClickAI: SmartClickAI | null;
  private readonly aiEnabled: boolean;

  private readonly defaultConfig: ProgressiveZoomConfig = {
    maxZoomSteps: 3,
    initialRegionSize: 600,
    zoomFactor: 2.0,
    confidenceThreshold: 0.8,
  };

  constructor() {
    this.zoomEnabled =
      (process.env.BYTEBOT_ZOOM_REFINEMENT ?? 'true').toLowerCase() !==
      'false';

    const aiFlag = process.env.BYTEBOT_PROGRESSIVE_ZOOM_USE_AI ?? 'true';
    if (this.zoomEnabled && aiFlag !== 'false') {
      this.smartClickAI = createSmartClickAI();
      this.aiEnabled = this.smartClickAI !== null;
    } else {
      this.smartClickAI = null;
      this.aiEnabled = false;
    }
  }

  /**
   * Extract PNG dimensions from a base64-encoded PNG.
   * Uses IHDR chunk (big-endian width/height) to avoid extra deps.
   */
  private getPngDimensions(base64Png: string): { width: number; height: number } | null {
    try {
      const buf = Buffer.from(base64Png, 'base64');
      // PNG signature (8 bytes) + IHDR length/type (8 bytes) + width/height (8 bytes)
      if (buf.length < 24) return null;
      // Width at byte offset 16-19, Height at 20-23 (big-endian)
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width === 0 || height === 0) {
        return null;
      }
      return { width, height };
    } catch {
      return null;
    }
  }

  /**
   * Performs progressive zoom to locate and click on a target element
   */
  async progressiveClickWithZoom(
    targetDescription: string,
    config: Partial<ProgressiveZoomConfig> = {},
  ): Promise<ProgressiveZoomResult> {
    if (!this.zoomEnabled) {
      this.logger.warn(
        'Zoom refinement disabled via BYTEBOT_ZOOM_REFINEMENT flag; skipping progressive zoom.',
      );
      return { success: false, steps: [], totalSteps: 0, confidence: 0 };
    }

    const cfg = { ...this.defaultConfig, ...config };
    const steps: ZoomStep[] = [];

    this.logger.log(`Starting progressive zoom for target: "${targetDescription}"`);

    try {
      // Step 1: Take full screenshot with grid
      this.logger.debug('Step 1: Taking full screenshot');
      const fullScreenshot = await this.takeScreenshot();
      const dims = this.getPngDimensions(fullScreenshot) ?? { width: 1920, height: 1080 };

      steps.push({
        step: 1,
        region: { x: 0, y: 0, width: dims.width, height: dims.height }, // Full screen
        zoomLevel: 1.0,
        screenshot: fullScreenshot,
      });

      // Step 2: Ask AI to identify quadrant containing target
      this.logger.debug('Step 2: AI identifying target quadrant');
      const quadrantResult = await this.identifyTargetQuadrant(
        fullScreenshot,
        targetDescription,
        dims.width,
        dims.height,
      );

      if (!quadrantResult.success) {
        this.logger.warn('AI failed to identify target quadrant');
        return {
          success: false,
          steps,
          totalSteps: 1,
          confidence: 0,
        };
      }

      // Step 3: Take zoomed screenshot of identified quadrant
      this.logger.debug(`Step 3: Taking zoomed screenshot of region ${JSON.stringify(quadrantResult.region)}`);
      const { screenshot: zoomedScreenshot, mapping } = await this.takeRegionScreenshot(
        quadrantResult.region.x,
        quadrantResult.region.y,
        quadrantResult.region.width,
        quadrantResult.region.height,
        cfg.zoomFactor,
      );

      steps.push({
        step: 2,
        region: quadrantResult.region,
        zoomLevel: cfg.zoomFactor,
        screenshot: zoomedScreenshot,
        mapping,
      });

      // Step 4: Ask AI for precise coordinates in zoomed view
      this.logger.debug('Step 4: AI determining precise coordinates in zoomed view');
      const preciseResult = await this.getPreciseCoordinates(
        zoomedScreenshot,
        targetDescription,
        mapping,
      );

      if (!preciseResult.success) {
        this.logger.warn('AI failed to determine precise coordinates');
        return {
          success: false,
          steps,
          totalSteps: 2,
          confidence: quadrantResult.confidence,
        };
      }

      // Step 5: Transform coordinates back to full screen and execute click
      this.logger.debug('Step 5: Transforming coordinates and executing click');
      const globalCoordinates = this.transformToGlobalCoordinates(
        preciseResult.localCoordinates,
        mapping,
      );
      const clickContext: ClickContext = {
        region: mapping.region,
        zoomLevel: mapping.zoomLevel,
        targetDescription,
        source: 'progressive_zoom',
      };

      const clickResult = await this.executeClick(
        globalCoordinates.x,
        globalCoordinates.y,
        clickContext,
      );

      this.logger.log(`Progressive zoom completed: ${clickResult ? 'SUCCESS' : 'FAILED'}`);

      return {
        success: clickResult && preciseResult.success,
        finalCoordinates: globalCoordinates,
        steps,
        totalSteps: steps.length,
        confidence: Math.min(quadrantResult.confidence, preciseResult.confidence),
      };

    } catch (error) {
      this.logger.error(`Progressive zoom failed: ${error.message}`, error.stack);
      return {
        success: false,
        steps,
        totalSteps: steps.length,
        confidence: 0,
      };
    }
  }

  /**
   * Takes a full screenshot
   */
  private async takeScreenshot(): Promise<string> {
    const screenshotBlock: ComputerToolUseContentBlock = {
      type: MessageContentType.ToolUse,
      id: 'screenshot_' + Date.now(),
      name: 'computer_screenshot',
      input: {},
    };

    const result = await handleComputerToolUse(screenshotBlock, this.logger);

    if (result.type === MessageContentType.ToolResult && result.content) {
      const imageContent = result.content.find(c => c.type === MessageContentType.Image);
      if (imageContent && 'source' in imageContent) {
        return imageContent.source.data;
      }
    }

    throw new Error('Failed to capture full screenshot');
  }

  /**
   * Takes a screenshot of a specific region with zoom
   */
  private async takeRegionScreenshot(
    x: number,
    y: number,
    width: number,
    height: number,
    zoomLevel: number = 1.0,
  ): Promise<{ screenshot: string; mapping: any }> {
    const regionBlock: ComputerToolUseContentBlock = {
      type: MessageContentType.ToolUse,
      id: 'screenshot_region_' + Date.now(),
      name: 'computer_screenshot_custom_region',
      input: {
        x,
        y,
        width,
        height,
        gridSize: 25,
        zoomLevel,
      },
    };

    const result = await handleComputerToolUse(regionBlock, this.logger);

    if (result.type === MessageContentType.ToolResult && result.content) {
      const imageContent = result.content.find(
        c => c.type === MessageContentType.Image,
      );
      if (imageContent && 'source' in imageContent) {
        return {
          screenshot: imageContent.source.data,
          mapping: {
            region: { x, y, width, height },
            zoomLevel,
          },
        };
      }
    }

    throw new Error('Failed to capture region screenshot');
  }

  /**
   * Uses AI to identify which quadrant contains the target
   */
  private async identifyTargetQuadrant(
    screenshot: string,
    targetDescription: string,
    screenWidth?: number,
    screenHeight?: number,
  ): Promise<{
    success: boolean;
    region: { x: number; y: number; width: number; height: number };
    confidence: number;
    reasoning: string;
  }> {
    this.logger.debug(
      `AI analyzing screenshot for target: "${targetDescription}"`,
    );

    if (this.aiEnabled && this.smartClickAI) {
      try {
        const prompt = `
You are analyzing a desktop screenshot with a visible 3x3 grid overlay.
Valid regions: top-left, top-center, top-right, middle-left, middle-center, middle-right, bottom-left, bottom-center, bottom-right.
Identify where "${targetDescription}" is located.
Respond ONLY with JSON: {"region":"<region>","confidence":0.0-1.0,"reason":"<short reason>"}.
`;

        const raw = await this.smartClickAI.askAboutScreenshot(
          screenshot,
          prompt,
        );
        const parsed = this.parseQuadrantResponse(raw);
        if (parsed) {
          const region = this.resolveRegionBounds(parsed.region, screenWidth, screenHeight);
          if (region) {
            return {
              success: true,
              region,
              confidence: parsed.confidence ?? 0.85,
              reasoning:
                parsed.reason ??
                'Smart focus model identified target quadrant from grid.',
            };
          }
        }
      } catch (error) {
        this.logger.warn(
          `Smart focus quadrant identification failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const fallbackRegion =
      this.resolveRegionBounds('middle-center', screenWidth, screenHeight) ?? {
        x: Math.floor((screenWidth ?? 1920) * 0.25),
        y: Math.floor((screenHeight ?? 1080) * 0.25),
        width: Math.floor((screenWidth ?? 1920) * 0.5),
        height: Math.floor((screenHeight ?? 1080) * 0.5),
      };

    return {
      success: true,
      region: fallbackRegion,
      confidence: 0.5,
      reasoning: 'Defaulted to middle-center region due to unavailable AI signal',
    };
  }

  /**
   * Uses AI to get precise coordinates within the zoomed view
   */
  private async getPreciseCoordinates(
    zoomedScreenshot: string,
    targetDescription: string,
    mapping: any,
  ): Promise<{
    success: boolean;
    localCoordinates: { x: number; y: number };
    confidence: number;
    reasoning: string;
  }> {
    this.logger.debug(`AI determining precise coordinates for target: "${targetDescription}"`);
    if (
      this.aiEnabled &&
      this.smartClickAI &&
      mapping?.region &&
      typeof mapping.region.x === 'number' &&
      typeof mapping.region.y === 'number' &&
      typeof mapping.region.width === 'number' &&
      typeof mapping.region.height === 'number'
    ) {
      try {
        const prompt = `
You are looking at a zoomed desktop screenshot with a cyan grid overlay.
The overlay shows global coordinates in parentheses. Provide the precise GLOBAL screen coordinates for "${targetDescription}".
Respond ONLY with JSON: {"x":<number>,"y":<number>}.
`;
        const globalCoords = await this.smartClickAI.getCoordinates(
          zoomedScreenshot,
          prompt,
        );

        if (
          !Number.isFinite(globalCoords.x) ||
          !Number.isFinite(globalCoords.y)
        ) {
          throw new Error('Smart focus returned invalid coordinate values');
        }

        const zoom = mapping.zoomLevel && mapping.zoomLevel > 0
          ? mapping.zoomLevel
          : 1;

        const localX = (globalCoords.x - mapping.region.x) * zoom;
        const localY = (globalCoords.y - mapping.region.y) * zoom;
        const maxLocalX = mapping.region.width * zoom;
        const maxLocalY = mapping.region.height * zoom;

        const localCoordinates = {
          x: Math.min(Math.max(localX, 0), maxLocalX),
          y: Math.min(Math.max(localY, 0), maxLocalY),
        };

        return {
          success: true,
          localCoordinates,
          confidence: 0.9,
          reasoning:
            'Smart focus model returned coordinates based on zoomed grid overlay.',
        };
      } catch (error) {
        this.logger.warn(
          `Smart focus precise coordinate extraction failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    const fallbackLocal = {
      x: mapping?.region?.width && mapping?.zoomLevel
        ? (mapping.region.width * mapping.zoomLevel) / 2
        : 300,
      y: mapping?.region?.height && mapping?.zoomLevel
        ? (mapping.region.height * mapping.zoomLevel) / 2
        : 200,
    };

    return {
      success: true,
      localCoordinates: fallbackLocal,
      confidence: 0.4,
      reasoning: 'Fallback to region midpoint due to unavailable AI coordinates',
    };
  }

  /**
   * Transforms local coordinates to global screen coordinates
   */
  private transformToGlobalCoordinates(
    localCoords: { x: number; y: number },
    mapping: any,
  ): { x: number; y: number } {
    if (!mapping || !mapping.region) {
      this.logger.warn('Missing mapping data, using local coordinates as-is');
      return localCoords;
    }

    // Transform based on region and zoom level
    const globalX = mapping.region.x + (localCoords.x / mapping.zoomLevel);
    const globalY = mapping.region.y + (localCoords.y / mapping.zoomLevel);

    this.logger.debug(`Transformed coordinates: (${localCoords.x}, ${localCoords.y}) → (${globalX}, ${globalY})`);

    return { x: Math.round(globalX), y: Math.round(globalY) };
  }

  /**
   * Executes the click at the calculated coordinates
   */
  private async executeClick(
    x: number,
    y: number,
    context?: ClickContext,
  ): Promise<boolean> {
    try {
      const clickBlock: ComputerToolUseContentBlock = {
        type: MessageContentType.ToolUse,
        id: 'click_' + Date.now(),
        name: 'computer_click_mouse',
        input: {
          coordinates: { x, y },
          button: 'left',
          clickCount: 1,
          context,
        },
      };

      const result = await handleComputerToolUse(clickBlock, this.logger);

      return result.type === MessageContentType.ToolResult && !result.is_error;
    } catch (error) {
      this.logger.error(`Click execution failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Parses the AI response describing which quadrant contains the target
   */
  private parseQuadrantResponse(
    response: string,
  ): { region: string; confidence?: number; reason?: string } | null {
    const trimmed = response?.trim();
    if (!trimmed) {
      return null;
    }

    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    const candidate = jsonMatch ? jsonMatch[0] : trimmed;

    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed.region === 'string') {
        return {
          region: parsed.region.toLowerCase(),
          confidence:
            typeof parsed.confidence === 'number'
              ? Math.min(Math.max(parsed.confidence, 0), 1)
              : undefined,
          reason:
            typeof parsed.reason === 'string' ? parsed.reason : undefined,
        };
      }
    } catch (error) {
      this.logger.debug(
        `Unable to parse quadrant JSON response, falling back to pattern matching: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const lower = trimmed.toLowerCase();
    const regionNames = this.createSmartRegions()
      .map(region => region.name)
      .sort((a, b) => b.length - a.length);
    const regionName = regionNames.find(name => lower.includes(name));

    if (regionName) {
      return { region: regionName };
    }

    return null;
  }

  private resolveRegionBounds(
    name: string,
    screenWidth?: number,
    screenHeight?: number,
  ): RegionBounds | null {
    const normalized = name?.toLowerCase().trim();
    if (!normalized) {
      return null;
    }

    const match = this.createSmartRegions(screenWidth, screenHeight).find(
      region => region.name === normalized,
    );
    return match?.region ?? null;
  }

  /**
   * Creates smart regions for common UI areas
   */
  createSmartRegions(
    screenWidth: number = 1920,
    screenHeight: number = 1080,
  ): Array<{
    name: string;
    region: RegionBounds;
    description: string;
  }> {
    const descriptions: Record<string, string> = {
      'top-left': 'Top-left quadrant - typically menus, toolbars, navigation',
      'top-center': 'Top-center region - typically tabs, search bars, or key navigation',
      'top-right': 'Top-right quadrant - typically controls, buttons, settings',
      'middle-left': 'Middle-left region - typically navigation, sidebars, or secondary menus',
      'middle-center': 'Middle-center region - typically main content, dialogs, forms',
      'middle-right': 'Middle-right region - typically inspector panes, actions, or chat widgets',
      'bottom-left': 'Bottom-left quadrant - typically status, navigation, sidebar',
      'bottom-center': 'Bottom-center region - typically footers, console output, or progress',
      'bottom-right': 'Bottom-right quadrant - typically content, scrollbars, actions',
      center: 'Center region - alias for middle-center region',
      'top-strip': 'Top strip - typically title bars, tabs, main navigation',
      'bottom-strip': 'Bottom strip - typically status bars, taskbars, notifications',
    };

    const xSegments = this.calculateSegments(screenWidth);
    const ySegments = this.calculateSegments(screenHeight);

    const verticalPositions: Array<{ key: 'top' | 'middle' | 'bottom'; rowIndex: 0 | 1 | 2 }> = [
      { key: 'top', rowIndex: 0 },
      { key: 'middle', rowIndex: 1 },
      { key: 'bottom', rowIndex: 2 },
    ];

    const horizontalPositions: Array<{ key: 'left' | 'center' | 'right'; colIndex: 0 | 1 | 2 }> = [
      { key: 'left', colIndex: 0 },
      { key: 'center', colIndex: 1 },
      { key: 'right', colIndex: 2 },
    ];

    const regions: Array<{ name: string; region: RegionBounds; description: string }> = [];

    for (const vertical of verticalPositions) {
      for (const horizontal of horizontalPositions) {
        const name = `${vertical.key}-${horizontal.key}`;
        const region: RegionBounds = {
          x: xSegments.start[horizontal.colIndex],
          y: ySegments.start[vertical.rowIndex],
          width: xSegments.size[horizontal.colIndex],
          height: ySegments.size[vertical.rowIndex],
        };

        regions.push({
          name,
          region,
          description: descriptions[name] ?? 'Smart focus region',
        });
      }
    }

    const middleCenter = regions.find(region => region.name === 'middle-center');
    if (middleCenter) {
      regions.push({
        name: 'center',
        region: middleCenter.region,
        description: descriptions.center,
      });
    }

    regions.push(
      {
        name: 'top-strip',
        region: {
          x: 0,
          y: 0,
          width: screenWidth,
          height: Math.max(Math.floor(screenHeight * 0.2), 1),
        },
        description: descriptions['top-strip'],
      },
      {
        name: 'bottom-strip',
        region: {
          x: 0,
          y: Math.max(screenHeight - Math.floor(screenHeight * 0.2), 0),
          width: screenWidth,
          height: Math.max(Math.floor(screenHeight * 0.2), 1),
        },
        description: descriptions['bottom-strip'],
      },
    );

    return regions;
  }

  private calculateSegments(total: number): {
    start: [number, number, number];
    size: [number, number, number];
  } {
    const firstBoundary = Math.round(total / 3);
    const secondBoundary = Math.round((2 * total) / 3);

    const start: [number, number, number] = [0, firstBoundary, secondBoundary];
    const size: [number, number, number] = [
      Math.max(firstBoundary, 1),
      Math.max(secondBoundary - firstBoundary, 1),
      Math.max(total - secondBoundary, 1),
    ];

    size[1] = Math.max(secondBoundary - firstBoundary, 1);
    size[2] = Math.max(total - secondBoundary, 1);

    const covered = start[2] + size[2];
    if (covered !== total) {
      size[2] = Math.max(total - start[2], 1);
    }

    return { start, size };
  }
}

// Export utility functions for direct use
export async function progressiveClickWithZoom(
  targetDescription: string,
  config: Partial<ProgressiveZoomConfig> = {},
): Promise<ProgressiveZoomResult> {
  const helper = new ProgressiveZoomHelper();
  return helper.progressiveClickWithZoom(targetDescription, config);
}

export function createSmartRegions(screenWidth: number = 1920, screenHeight: number = 1080) {
  const helper = new ProgressiveZoomHelper();
  return helper.createSmartRegions(screenWidth, screenHeight);
}
