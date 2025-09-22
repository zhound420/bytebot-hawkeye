import * as sharp from 'sharp';

export interface OverlayDescriptor
  extends Pick<sharp.OverlayOptions, 'top' | 'left' | 'blend' | 'density'> {
  input: Buffer | string;
}

export class ScreenshotAnnotator {
  private readonly overlays: sharp.OverlayOptions[] = [];

  private constructor(
    private readonly baseImage: Buffer,
    private readonly width: number,
    private readonly height: number,
  ) {}

  static async from(image: Buffer): Promise<ScreenshotAnnotator> {
    const metadata = await sharp(image)
      .metadata()
      .catch(() => ({ width: 0, height: 0 }));

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    return new ScreenshotAnnotator(image, width, height);
  }

  get dimensions(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  get hasOverlays(): boolean {
    return this.overlays.length > 0;
  }

  addOverlay(descriptor?: OverlayDescriptor): void {
    if (!descriptor) {
      return;
    }

    const { input, top = 0, left = 0, ...rest } = descriptor;
    if (!input) {
      return;
    }

    this.overlays.push({ input, top, left, ...rest });
  }

  async render(): Promise<{ buffer: Buffer; width: number; height: number }> {
    if (!this.width || !this.height || this.overlays.length === 0) {
      return {
        buffer: this.baseImage,
        width: this.width,
        height: this.height,
      };
    }

    const buffer = await sharp(this.baseImage)
      .composite(this.overlays)
      .png()
      .toBuffer();

    return { buffer, width: this.width, height: this.height };
  }
}
