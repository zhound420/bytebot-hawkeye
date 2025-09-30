import { BoundingBox, DetectedElement, ElementType } from '../../types';
import { decodeImageBuffer } from '../../utils/cv-decode';
import { getOpenCvModule, logOpenCvWarning } from '../../utils/opencv-loader';

type CvModule = any;
type CvRect = any;
type CvMat = any;

export class EdgeDetector {
  private readonly cv = getOpenCvModule();

  constructor() {
    logOpenCvWarning('EdgeDetector');
  }

  async detect(screenshotBuffer: Buffer, region?: BoundingBox): Promise<DetectedElement[]> {
    if (!screenshotBuffer?.length) {
      return [];
    }

    const cv = this.cv;

    if (!cv) {
      return [];
    }

    const screenshot = decodeImageBuffer(cv, screenshotBuffer, {
      source: 'EdgeDetector.detect',
    });
    const { mat: searchMat, offsetX, offsetY } = this.extractRegion(cv, screenshot, region);
    const gray = searchMat.cvtColor(cv.COLOR_BGR2GRAY);
    const blurred = gray.gaussianBlur(new cv.Size(5, 5), 0);
    const edges = blurred.canny(50, 150);
    const contours = edges.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const elements: DetectedElement[] = [];

    for (const contour of contours) {
      const rect = contour.boundingRect();

      if (!this.isLikelyElement(rect)) {
        continue;
      }

      const x = rect.x + offsetX;
      const y = rect.y + offsetY;
      const width = rect.width;
      const height = rect.height;

      elements.push({
        id: this.generateElementId('edge'),
        type: this.inferElementTypeFromShape(rect),
        coordinates: {
          x,
          y,
          width,
          height,
          centerX: x + width / 2,
          centerY: y + height / 2
        },
        confidence: 0.6,
        description: `Edge-detected element (${width}x${height})`,
        metadata: {
          detectionMethod: 'edge'
        }
      });
    }

    return elements;
  }

  private isLikelyElement(rect: CvRect): boolean {
    return (
      rect.width > 20 &&
      rect.height > 15 &&
      rect.width < 400 &&
      rect.height < 160
    );
  }

  private inferElementTypeFromShape(rect: CvRect): ElementType {
    const aspectRatio = rect.width / Math.max(rect.height, 1);

    if (aspectRatio > 1.5 && aspectRatio < 6 && rect.height >= 20 && rect.height <= 60) {
      return 'button';
    }

    if (aspectRatio > 3 && rect.height >= 15 && rect.height <= 40) {
      return 'input';
    }

    return 'unknown';
  }

  private extractRegion(cv: CvModule, image: CvMat, region?: BoundingBox): {
    mat: CvMat;
    offsetX: number;
    offsetY: number;
  } {
    if (!region) {
      return { mat: image, offsetX: 0, offsetY: 0 };
    }

    const x = Math.max(0, Math.min(Math.floor(region.x), image.cols - 1));
    const y = Math.max(0, Math.min(Math.floor(region.y), image.rows - 1));
    const width = Math.max(1, Math.min(Math.floor(region.width), image.cols - x));
    const height = Math.max(1, Math.min(Math.floor(region.height), image.rows - y));

    if (width <= 0 || height <= 0) {
      return { mat: image, offsetX: 0, offsetY: 0 };
    }

    const rect = new cv.Rect(x, y, width, height);
    return { mat: image.getRegion(rect), offsetX: x, offsetY: y };
  }

  private generateElementId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
