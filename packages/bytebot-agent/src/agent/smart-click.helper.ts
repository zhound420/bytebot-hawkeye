import * as fs from 'fs';
import * as path from 'path';
import { ClickContext } from '@bytebot/shared';

export interface SmartClickAI {
  askAboutScreenshot(image: string, prompt: string): Promise<string>;
  getCoordinates(
    image: string,
    prompt: string,
  ): Promise<{ x: number; y: number }>;
}

interface ScreenshotResponse {
  image: string;
  offset?: { x: number; y: number };
  region?: { x: number; y: number; width: number; height: number };
  zoomLevel?: number;
}

interface ScreenshotFnOptions {
  gridOverlay?: boolean;
  gridSize?: number;
  highlightRegions?: boolean;
  showCursor?: boolean;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  markTarget?: {
    coordinates: { x: number; y: number };
    label?: string;
  };
}

interface ScreenshotRegionOptions {
  region: string;
  gridSize?: number;
  enhance?: boolean;
  includeOffset?: boolean;
  addHighlight?: boolean;
  showCursor?: boolean;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  zoomLevel?: number;
}

interface ScreenshotCustomRegionOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  gridSize?: number;
  zoomLevel?: number;
  showCursor?: boolean;
}

interface ScreenshotTargetOptions {
  coordinates: { x: number; y: number };
  label?: string;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  showCursor?: boolean;
}

export interface SmartClickResult {
  coordinates: { x: number; y: number };
  context: ClickContext;
}

export class SmartClickHelper {
  private readonly proxyUrl?: string;
  private readonly model: string;
  private readonly progressDir: string;
  private currentTaskId = '';

  constructor(
    private readonly ai: SmartClickAI | null,
    private readonly screenshotFn: (
      options?: ScreenshotFnOptions,
    ) => Promise<ScreenshotResponse>,
    private readonly screenshotRegionFn: (
      options: ScreenshotRegionOptions,
    ) => Promise<ScreenshotResponse>,
    private readonly screenshotCustomRegionFn: (
      options: ScreenshotCustomRegionOptions,
    ) => Promise<ScreenshotResponse>,
    options: { proxyUrl?: string; model?: string; progressDir?: string } = {},
  ) {
    this.proxyUrl = options.proxyUrl ?? process.env.BYTEBOT_LLM_PROXY_URL;
    this.model =
      options.model ??
      process.env.BYTEBOT_SMART_FOCUS_MODEL ??
      'gpt-4-vision-preview';
    this.progressDir =
      options.progressDir ??
      process.env.BYTEBOT_SMART_FOCUS_PROGRESS_DIR ??
      '/app/progress';

    if (!this.proxyUrl) {
      console.warn('⚠️  BYTEBOT_LLM_PROXY_URL not set. Smart Focus disabled.');
      console.warn(
        '   Set BYTEBOT_LLM_PROXY_URL to enable Smart Focus (e.g. https://api.openai.com/v1/chat/completions).',
      );
    } else {
      console.log('✅ Smart Focus enabled with proxy:', this.proxyUrl);
      console.log('   Model:', this.model);
    }

    this.ensureDirectory(this.progressDir);
  }

  private async emitTelemetryEvent(
    type: string,
    data: Record<string, any> = {},
  ): Promise<void> {
    try {
      const base = process.env.BYTEBOT_DESKTOP_BASE_URL;
      if (!base) return;
      const payload =
        type === 'smart_click_complete' && this.currentTaskId
          ? { clickTaskId: this.currentTaskId, ...data }
          : data;
      await fetch(`${base}/telemetry/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ...payload }),
      });
    } catch {
      // ignore
    }
  }

  async performSmartClick(
    targetDescription: string,
  ): Promise<SmartClickResult | null> {
    await this.emitTelemetryEvent('smart_click', {
      phase: 'start',
      targetDescription,
    });
    if (!this.proxyUrl || !this.ai) {
      console.log('Smart Focus not configured, falling back to standard click');
      return null;
    }

    try {
      this.currentTaskId = `click-${Date.now()}`;
      const taskDir = path.join(this.progressDir, this.currentTaskId);
      this.ensureDirectory(taskDir);
      const currentDir = path.join(this.progressDir, 'current');
      this.ensureDirectory(currentDir);

      console.log(`📸 Smart Focus Progress: ${this.currentTaskId}`);
      console.log(`   Target: "${targetDescription}"`);
      console.log(`🎯 Smart Focus: Looking for "${targetDescription}"`);

      const fullScreen = await this.screenshot({
        gridOverlay: true,
        gridSize: 200,
        highlightRegions: true,
        progressStep: 1,
        progressMessage: `Full screen analysis for "${targetDescription}"`,
        progressTaskId: this.currentTaskId,
        showCursor: true,
      });

      await Promise.all([
        this.saveImage(taskDir, '01-full-screen.png', fullScreen.image),
        this.saveImage(currentDir, '01-full-screen.png', fullScreen.image),
      ]);

      const regionPrompt = `
        Looking at this screenshot with a 3x3 region grid:
        - top-left, top-center, top-right
        - middle-left, middle-center, middle-right  
        - bottom-left, bottom-center, bottom-right

        Which region contains: "${targetDescription}"?
        Respond with just the region name.
      `;

      const targetRegion = await this.ai.askAboutScreenshot(
        fullScreen.image,
        regionPrompt,
      );
      const regionName = targetRegion.trim();
      console.log(`📍 Smart Focus region identified: ${regionName}`);

      console.log('   Step 2: Focusing on region...');
      const gridSize = this.inferGridSize(targetDescription);
      const focusedShot = await this.screenshotRegion({
        region: regionName,
        gridSize,
        enhance: true,
        includeOffset: true,
        addHighlight: true,
        progressStep: 2,
        progressMessage: `Focused on region ${regionName}`,
        progressTaskId: this.currentTaskId,
        zoomLevel: 2.0,
        showCursor: true,
      });

      const regionFile = `02-region-${regionName
        .replace(/\s+/g, '-')
        .toLowerCase()}.png`;
      await Promise.all([
        this.saveImage(taskDir, regionFile, focusedShot.image),
        this.saveImage(currentDir, '02-region.png', focusedShot.image),
      ]);
      await this.emitTelemetryEvent('progressive_zoom', {
        region: regionName,
        zoom: 2.0,
      });

      const precisePrompt = `
        This is a zoomed view of the ${regionName} region.
        The grid shows coordinates relative to the full screen.

        Find "${targetDescription}" and provide exact coordinates using the grid.
        The grid labels show the actual screen coordinates.
      `;

      console.log('   Step 3: Calculating precise coordinates...');
      let coordinates = await this.ai.getCoordinates(
        focusedShot.image,
        precisePrompt,
      );

      console.log(
        `✅ Smart Focus located coordinates (${coordinates.x}, ${coordinates.y})`,
      );

      // Heuristic confidence: if near region edge, refine with higher zoom
      try {
        const region = focusedShot.region;
        if (region) {
          const margin = 15; // px
          const nearLeft = coordinates.x - region.x < margin;
          const nearRight = region.x + region.width - coordinates.x < margin;
          const nearTop = coordinates.y - region.y < margin;
          const nearBottom = region.y + region.height - coordinates.y < margin;
          const nearEdge = nearLeft || nearRight || nearTop || nearBottom;
          if (nearEdge) {
            console.log(
              '   Refining coordinates with precision zoom (near edge) ...',
            );
            const w = 240;
            const h = 180;
            const rx = Math.max(0, coordinates.x - Math.floor(w / 2));
            const ry = Math.max(0, coordinates.y - Math.floor(h / 2));
            const refineShot = await this.screenshotCustomRegion(
              rx,
              ry,
              w,
              h,
              25,
              3.0,
            );
            await Promise.all([
              this.saveImage(taskDir, '03a-refine.png', refineShot),
              this.saveImage(currentDir, '03a-refine.png', refineShot),
            ]);
            await this.emitTelemetryEvent('progressive_zoom', {
              region: 'custom',
              zoom: 3.0,
            });

            const refinePrompt = `Refine the exact screen coordinates for "${targetDescription}" with this higher-zoom image.`;
            const refined = await this.ai.getCoordinates(
              refineShot,
              refinePrompt,
            );
            if (
              Number.isFinite(refined.x) &&
              Number.isFinite(refined.y) &&
              (Math.abs(refined.x - coordinates.x) > 1 ||
                Math.abs(refined.y - coordinates.y) > 1)
            ) {
              console.log(
                `   Precision refine: (${coordinates.x}, ${coordinates.y}) → (${refined.x}, ${refined.y})`,
              );
              coordinates = refined;
            }
          }
        }
      } catch (refineError) {
        console.warn('Precision refine failed:', refineError);
      }

      console.log(
        `   Step 4: Marking target at (${coordinates.x}, ${coordinates.y})`,
      );
      const finalShot = await this.screenshotWithTarget({
        coordinates,
        label: targetDescription,
        progressStep: 3,
        progressMessage: `Target locked at (${coordinates.x}, ${coordinates.y})`,
        progressTaskId: this.currentTaskId,
        showCursor: true,
      });

      await Promise.all([
        this.saveImage(taskDir, '03-target-marked.png', finalShot.image),
        this.saveImage(currentDir, '03-target.png', finalShot.image),
      ]);

      await this.generateProgressSummary(
        taskDir,
        targetDescription,
        coordinates,
        regionFile,
      );
      try {
        fs.copyFileSync(
          path.join(taskDir, 'progress.html'),
          path.join(currentDir, 'progress.html'),
        );
      } catch (copyError) {
        console.error('Failed to update live progress summary:', copyError);
      }
      console.log(`   ✅ Complete! Progress saved to: ${taskDir}`);

      const context: ClickContext = {
        region: focusedShot.region,
        zoomLevel: focusedShot.zoomLevel,
        targetDescription,
        source: 'smart_focus',
        clickTaskId: this.currentTaskId,
      };

      return { coordinates, context };
    } catch (error) {
      console.error('Smart Focus failed:', error);
      console.log('Falling back to standard click');
      await this.emitTelemetryEvent('smart_click_complete', {
        success: false,
        clickTaskId: this.currentTaskId,
      });
      if (this.currentTaskId) {
        try {
          const taskDir = path.join(this.progressDir, this.currentTaskId);
          this.ensureDirectory(taskDir);
          fs.writeFileSync(
            path.join(taskDir, 'error.txt'),
            `Failed to find: ${targetDescription}\nError: ${
              (error as Error)?.message ?? error
            }`,
          );
        } catch (writeError) {
          console.error('Unable to write Smart Focus error log:', writeError);
        }
      }
      return null;
    }
  }

  async binarySearchClick(
    targetDescription: string,
    maxIterations: number = 4,
  ): Promise<SmartClickResult | null> {
    if (!this.proxyUrl || !this.ai) {
      console.log(
        'Binary search unavailable without Smart Focus configuration',
      );
      return null;
    }

    console.log(`🔍 Binary search targeting: "${targetDescription}"`);
    // Derive screen dimensions from a quick full screenshot to avoid hardcoding
    let full: ScreenshotResponse | null = null;
    try {
      full = await this.screenshot({ gridOverlay: true, showCursor: true });
    } catch {
      // ignore – will fall back to defaults
    }
    const dims = full ? this.getPngDimensions(full.image) : null;
    const bounds = {
      x: 0,
      y: 0,
      width: dims?.width ?? 1920,
      height: dims?.height ?? 1080,
    };

    try {
      for (let i = 0; i < maxIterations; i++) {
        const region = await this.screenshotCustomRegion(
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
        );

        const horizontalAnswer = await this.ai.askAboutScreenshot(
          region,
          `Is "${targetDescription}" in the left half or right half of this image?`,
        );

        const halfWidth = Math.max(Math.floor(bounds.width / 2), 1);
        if (horizontalAnswer.toLowerCase().includes('left')) {
          bounds.width = halfWidth;
        } else {
          bounds.x += bounds.width - halfWidth;
          bounds.width = halfWidth;
        }

        const verticalAnswer = await this.ai.askAboutScreenshot(
          region,
          `Is "${targetDescription}" in the top half or bottom half of this image?`,
        );

        const halfHeight = Math.max(Math.floor(bounds.height / 2), 1);
        if (verticalAnswer.toLowerCase().includes('top')) {
          bounds.height = halfHeight;
        } else {
          bounds.y += bounds.height - halfHeight;
          bounds.height = halfHeight;
        }
      }

      const result = {
        x: bounds.x + Math.floor(bounds.width / 2),
        y: bounds.y + Math.floor(bounds.height / 2),
      };

      console.log(`✅ Binary search estimate: (${result.x}, ${result.y})`);
      return {
        coordinates: result,
        context: {
          region: {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
          },
          targetDescription,
          source: 'binary_search',
        },
      };
    } catch (error) {
      console.error('Binary search click failed:', error);
      return null;
    }
  }

  private screenshot(
    options?: ScreenshotFnOptions,
  ): Promise<ScreenshotResponse> {
    const mergedOptions: ScreenshotFnOptions = {
      ...(options ?? {}),
      showCursor: options?.showCursor ?? true,
    };
    return this.screenshotFn(mergedOptions);
  }

  private async screenshotRegion(
    options: ScreenshotRegionOptions,
  ): Promise<ScreenshotResponse> {
    const mergedOptions: ScreenshotRegionOptions = {
      ...options,
      showCursor: options.showCursor ?? true,
    };
    return this.screenshotRegionFn(mergedOptions);
  }

  private async screenshotCustomRegion(
    x: number,
    y: number,
    width: number,
    height: number,
    gridSize?: number,
    zoomLevel?: number,
    showCursor?: boolean,
  ): Promise<string> {
    const result = await this.screenshotCustomRegionFn({
      x,
      y,
      width,
      height,
      gridSize,
      zoomLevel,
      showCursor: showCursor ?? true,
    });

    return result.image;
  }

  private async screenshotWithTarget(
    options: ScreenshotTargetOptions,
  ): Promise<ScreenshotResponse> {
    return this.screenshotFn({
      gridOverlay: true,
      progressTaskId: options.progressTaskId,
      progressStep: options.progressStep,
      progressMessage: options.progressMessage,
      markTarget: {
        coordinates: options.coordinates,
        label: options.label,
      },
      showCursor: options.showCursor ?? true,
    });
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private inferGridSize(description: string): number {
    const d = description.toLowerCase();
    // Mirror daemon's adaptive grid intentions
    if (/(tiny|small|icon|favicon|glyph|checkbox|radio)/.test(d)) return 20;
    if (/(text|caret|cursor|inline|link)/.test(d)) return 25;
    if (/(menu|dropdown|toolbar|tab)/.test(d)) return 40;
    if (/(button|cta|submit|ok|save)/.test(d)) return 50;
    return 25; // sensible default
  }

  private async saveImage(
    taskDir: string,
    fileName: string,
    base64: string,
  ): Promise<void> {
    const filePath = path.join(taskDir, fileName);
    const payload = Buffer.from(base64, 'base64');
    const maxAttempts = 3;
    let attempt = 0;
    let delay = 50;

    while (attempt < maxAttempts) {
      try {
        await fs.promises.writeFile(filePath, payload);
        return;
      } catch (error) {
        attempt += 1;
        if (attempt >= maxAttempts) {
          console.error('Failed to save Smart Focus image:', error);
          return;
        }
        console.warn(
          `Retrying Smart Focus image save for ${fileName} (attempt ${attempt}/${maxAttempts})`,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  }

  private async generateProgressSummary(
    taskDir: string,
    target: string,
    coords: { x: number; y: number },
    regionFile: string,
  ): Promise<void> {
    const template = `<!DOCTYPE html>
<html>
<head>
  <title>Smart Focus Progress: ${target}</title>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #0d1117; color: #c9d1d9; margin: 0; padding: 24px; }
    .container { max-width: 960px; margin: 0 auto; }
    .metrics { background: #161b22; padding: 18px 24px; border-radius: 8px; margin-bottom: 24px; }
    .metrics h2 { margin: 0 0 12px 0; color: #58a6ff; }
    .metrics p { margin: 4px 0; }
    .step { background: #161b22; border-radius: 8px; padding: 18px; margin-bottom: 24px; border-left: 4px solid #4CAF50; }
    .step h3 { margin-top: 0; }
    .step img { width: 100%; max-width: 720px; border-radius: 6px; margin-top: 12px; }
    .success { color: #4CAF50; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 Smart Focus Progress</h1>
    <div class="metrics">
      <h2>Target: "${target}"</h2>
      <p class="success">Final Coordinates: (${coords.x}, ${coords.y})</p>
      <p>Task ID: ${this.currentTaskId}</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
    </div>

    <div class="step">
      <h3>Step 1: Full Screen Analysis</h3>
      <p>Identified candidate region using a 200px grid overlay.</p>
      <img src="01-full-screen.png" alt="Full screen progress" />
    </div>

    <div class="step">
      <h3>Step 2: Focused Region</h3>
      <p>Zoomed into the predicted region for detailed inspection.</p>
      <img src="${regionFile}" alt="Focused region" />
    </div>

    <div class="step">
      <h3>Step 3: Target Locked</h3>
      <p class="success">Target confirmed at (${coords.x}, ${coords.y}).</p>
      <img src="03-target-marked.png" alt="Target marked" />
    </div>
  </div>
</body>
</html>`;

    try {
      fs.writeFileSync(path.join(taskDir, 'progress.html'), template, 'utf8');
    } catch (error) {
      console.error('Failed to write Smart Focus progress summary:', error);
    }
  }
  private getPngDimensions(
    base64Png: string,
  ): { width: number; height: number } | null {
    try {
      const buf = Buffer.from(base64Png, 'base64');
      if (buf.length < 24) return null;
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width === 0 ||
        height === 0
      ) {
        return null;
      }
      return { width, height };
    } catch {
      return null;
    }
  }
}
