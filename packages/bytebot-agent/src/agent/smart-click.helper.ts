import * as fs from 'fs';
import * as path from 'path';
import { ClickContext } from '@bytebot/shared';
import {
  SmartClickAI,
  SmartClickResult,
  ScreenshotResponse,
  ScreenshotFnOptions,
  ScreenshotCustomRegionOptions,
  ScreenshotTargetOptions,
} from './smart-click.types';
import {
  UniversalCoordinateResult,
  UniversalCoordinateStep,
  UniversalCoordinateSystem,
} from '../coordinate-system';

export class SmartClickHelper {
  private readonly proxyUrl?: string;
  private readonly model: string;
  private readonly progressDir: string;
  private currentTaskId = '';
  private readonly coordinateSystem: UniversalCoordinateSystem | null;

  constructor(
    private readonly ai: SmartClickAI | null,
    private readonly screenshotFn: (
      options?: ScreenshotFnOptions,
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

    this.coordinateSystem = this.ai
      ? new UniversalCoordinateSystem({
          ai: this.ai,
          capture: {
            full: (options) => this.screenshot(options),
            zoom: (options) =>
              this.screenshotCustomRegionFn({
                ...options,
                showCursor: options.showCursor ?? true,
              }),
          },
        })
      : null;
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

    if (!this.coordinateSystem) {
      console.warn('Smart Focus coordinate system unavailable.');
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

      const result = await this.coordinateSystem.locate(targetDescription, {
        gridSizeHint: this.inferGridSize(targetDescription),
        progress: {
          taskId: this.currentTaskId,
          fullStep: {
            step: 1,
            message: `Teaching overlay for "${targetDescription}"`,
          },
          zoomStep: {
            step: 2,
            message: `Zoom refinement for "${targetDescription}"`,
          },
        },
      });

      const persistedSteps = await this.persistSteps(
        result.steps,
        taskDir,
        currentDir,
      );

      const zoomStep = result.steps.find((step) => step.id === 'zoom-refine');
      if (zoomStep) {
        await this.emitTelemetryEvent('progressive_zoom', {
          region: result.context.region
            ? JSON.stringify(result.context.region)
            : 'custom',
          zoom: result.context.zoomLevel ?? 2,
          confidence: result.confidence ?? undefined,
        });
      }

      console.log(
        `✅ Smart Focus located coordinates (${result.coordinates.x}, ${result.coordinates.y})`,
      );
      if (typeof result.confidence === 'number') {
        console.log(
          `   Reported confidence: ${(result.confidence * 100).toFixed(1)}%`,
        );
      }

      const finalShot = await this.screenshotWithTarget({
        coordinates: result.coordinates,
        label: targetDescription,
        progressStep: 3,
        progressMessage: `Target locked at (${result.coordinates.x}, ${result.coordinates.y})`,
        progressTaskId: this.currentTaskId,
        showCursor: true,
      });

      await Promise.all([
        this.saveImage(taskDir, '03-target-marked.png', finalShot.image),
        this.saveImage(currentDir, '03-target.png', finalShot.image),
      ]);

      await this.generateProgressSummary({
        taskDir,
        target: targetDescription,
        result,
        steps: persistedSteps,
      });
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
        ...result.context,
        targetDescription,
        source: 'smart_focus',
        clickTaskId: this.currentTaskId,
      };

      await this.emitTelemetryEvent('smart_click_complete', {
        success: true,
        clickTaskId: this.currentTaskId,
        coordinates: result.coordinates,
        confidence: result.confidence ?? undefined,
      });

      return { coordinates: result.coordinates, context };
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

  private sanitizeStepId(id: string): string {
    const normalized = id
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .trim();
    return normalized || 'step';
  }

  private async persistSteps(
    steps: UniversalCoordinateStep[],
    taskDir: string,
    currentDir: string,
  ): Promise<Array<{ step: UniversalCoordinateStep; fileName: string }>> {
    const persisted: Array<{
      step: UniversalCoordinateStep;
      fileName: string;
    }> = [];
    for (let index = 0; index < steps.length; index += 1) {
      const step = steps[index];
      const sanitizedId = this.sanitizeStepId(step.id);
      const prefix = String(index + 1).padStart(2, '0');
      const fileName = `${prefix}-${sanitizedId}.png`;
      await Promise.all([
        this.saveImage(taskDir, fileName, step.screenshot.image),
        this.saveImage(
          currentDir,
          `${prefix}-${sanitizedId}.png`,
          step.screenshot.image,
        ),
      ]);
      persisted.push({ step, fileName });
    }
    return persisted;
  }

  private async generateProgressSummary(options: {
    taskDir: string;
    target: string;
    result: UniversalCoordinateResult;
    steps: Array<{ step: UniversalCoordinateStep; fileName: string }>;
  }): Promise<void> {
    const { taskDir, target, result, steps } = options;
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
    .meta { font-size: 13px; color: #8b949e; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 Smart Focus Progress</h1>
    <div class="metrics">
      <h2>Target: "${target}"</h2>
      <p class="success">Final Coordinates: (${result.coordinates.x}, ${result.coordinates.y})</p>
      <p>Base Estimate: (${result.baseCoordinates.x}, ${result.baseCoordinates.y})</p>
      <p>Applied Offset: ${
        result.appliedOffset
          ? `(${result.appliedOffset.x}, ${result.appliedOffset.y})`
          : 'None'
      }</p>
      <p>Confidence: ${
        typeof result.confidence === 'number'
          ? `${(result.confidence * 100).toFixed(1)}%`
          : 'n/a'
      }</p>
      ${
        result.reasoning
          ? `<p class="meta">Reasoning: ${result.reasoning}</p>`
          : ''
      }
      <p>Task ID: ${this.currentTaskId}</p>
      <p>Timestamp: ${new Date().toISOString()}</p>
    </div>

    ${steps
      .map(
        ({ step, fileName }, index) => `
    <div class="step">
      <h3>Step ${index + 1}: ${step.label}</h3>
      ${
        step.response.reasoning
          ? `<p class="meta">${step.response.reasoning}</p>`
          : ''
      }
      ${
        typeof step.response.confidence === 'number'
          ? `<p class="meta">Confidence: ${(step.response.confidence * 100).toFixed(1)}%</p>`
          : ''
      }
      <img src="${fileName}" alt="${step.label}" />
    </div>
    `,
      )
      .join('')}

    <div class="step">
      <h3>Step ${steps.length + 1}: Target Locked</h3>
      <p class="success">Target confirmed at (${result.coordinates.x}, ${result.coordinates.y}).</p>
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
