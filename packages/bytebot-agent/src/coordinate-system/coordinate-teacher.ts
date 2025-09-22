import { Coordinates } from '../agent/smart-click.types';

export interface FullFramePromptOptions {
  targetDescription: string;
  offsetHint?: Coordinates | null;
}

export interface ZoomPromptOptions {
  targetDescription: string;
  region: { x: number; y: number; width: number; height: number };
  zoomLevel: number;
  offsetHint?: Coordinates | null;
  fallbackGlobal?: Coordinates | null;
}

export class CoordinateTeacher {
  private readonly overlayLegend = [
    '🟩 Overlay legend:',
    '  • Corner callouts display (0,0), (width,0), (0,height), (width,height).',
    '  • Lime rulers along the top and left edges tick every grid interval.',
    '  • Grid lines span the frame every interval to form a square lattice.',
  ].join('\n');

  getOverlayLegend(): string {
    return this.overlayLegend;
  }

  buildFullFramePrompt(options: FullFramePromptOptions): string {
    const parts: string[] = [];
    parts.push(
      'You are the Universal Coordinate Teacher. Learn from the overlay before answering.',
    );
    parts.push(this.overlayLegend);
    parts.push(
      'Task: locate the target element precisely using the global grid annotations.',
    );
    parts.push(`Target description: "${options.targetDescription}".`);

    if (options.offsetHint) {
      parts.push(
        `Calibration: recent offset applied (${options.offsetHint.x}, ${options.offsetHint.y}). Add this drift correction to your calculation if the overlay looks shifted.`,
      );
    }

    parts.push('Respond ONLY with minified JSON matching this schema:');
    parts.push(
      '{"global":{"x":number,"y":number},"confidence":0-1,"needsZoom":boolean,"zoom":{"center":{"x":number,"y":number},"radius":number},"reasoning":"short"}',
    );
    parts.push(
      'If you are already confident (>=0.85) set needsZoom=false. Otherwise, set needsZoom=true and suggest a zoom center (global) and radius in pixels.',
    );

    return parts.join('\n');
  }

  buildZoomPrompt(options: ZoomPromptOptions): string {
    const { region, zoomLevel, targetDescription } = options;
    const parts: string[] = [];
    parts.push('Precision refinement step.');
    parts.push(this.overlayLegend);
    parts.push(
      `Zoom metadata: region (${region.x}, ${region.y}, ${region.width}, ${region.height}), zoomLevel=${zoomLevel}. Grid labels remain GLOBAL coordinates.`,
    );
    if (options.fallbackGlobal) {
      parts.push(
        `Previous estimate: (${options.fallbackGlobal.x}, ${options.fallbackGlobal.y}). Use this as a hint but refine using the zoomed overlay.`,
      );
    }
    if (options.offsetHint) {
      parts.push(
        `Calibration: apply offset (${options.offsetHint.x}, ${options.offsetHint.y}) if the zoom looks shifted relative to the grid origin.`,
      );
    }
    parts.push(`Target: "${targetDescription}".`);
    parts.push('Reply ONLY with JSON:');
    parts.push(
      '{"global":{"x":number,"y":number},"local":{"x":number,"y":number},"confidence":0-1,"reasoning":"short"}',
    );
    parts.push(
      'The "local" value is the coordinate within this zoomed crop. Always ensure the global pair equals the annotated labels. Confidence must be between 0 and 1.',
    );

    return parts.join('\n');
  }
}
