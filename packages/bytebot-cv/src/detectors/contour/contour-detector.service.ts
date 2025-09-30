import { Injectable, Logger } from '@nestjs/common';
import { getOpenCvModule, hasOpenCv } from '../../utils/opencv-loader';

const cv = getOpenCvModule();

export interface ContourResult {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  aspectRatio: number;
  shape: string;
  confidence: number;
}

export interface ContourOptions {
  minArea?: number;
  maxArea?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
  approximationAccuracy?: number;
  shapeTypes?: ('rectangle' | 'circle' | 'triangle' | 'polygon')[];
}

@Injectable()
export class ContourDetectorService {
  private readonly logger = new Logger(ContourDetectorService.name);

  constructor() {
    this.logger.log('Contour Detector Service initialized');
  }

  /**
   * Find UI elements by shape analysis (buttons, input fields, icons)
   * Excellent for detecting standard UI components
   */
  async findElementsByShape(
    image: any,
    options: ContourOptions = {}
  ): Promise<ContourResult[]> {
    if (!hasOpenCv || !image) {
      this.logger.warn('Contour detection unavailable: missing OpenCV or input');
      return [];
    }

    const {
      minArea = 100,
      maxArea = 50000,
      minAspectRatio = 0.1,
      maxAspectRatio = 10.0,
      approximationAccuracy = 0.02,
      shapeTypes = ['rectangle', 'circle']
    } = options;

    try {
      // Convert to grayscale and apply edge detection
      const gray = image.channels === 3 ? image.cvtColor(cv.COLOR_BGR2GRAY) : image;

      // Apply Gaussian blur to reduce noise
      const blurred = gray.gaussianBlur(new cv.Size(5, 5), 0);

      // Use Canny edge detection
      const edges = blurred.canny(50, 150);

      // Find contours
      const contours = edges.findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      const results: ContourResult[] = [];

      for (const contour of contours) {
        const area = contour.area;

        // Filter by area
        if (area < minArea || area > maxArea) continue;

        const boundingRect = contour.boundingRect();
        const aspectRatio = boundingRect.width / boundingRect.height;

        // Filter by aspect ratio
        if (aspectRatio < minAspectRatio || aspectRatio > maxAspectRatio) continue;

        // Approximate contour to polygon
        const perimeter = contour.arcLength(true);
        const approxPoly = contour.approxPolyDP(approximationAccuracy * perimeter, true);

        // Classify shape
        const shapeInfo = this.classifyShape(approxPoly, contour, boundingRect);

        // Filter by shape type if specified
        if (shapeTypes.length > 0 && !shapeTypes.includes(shapeInfo.shape as any)) {
          continue;
        }

        results.push({
          x: boundingRect.x,
          y: boundingRect.y,
          width: boundingRect.width,
          height: boundingRect.height,
          area: area,
          aspectRatio: aspectRatio,
          shape: shapeInfo.shape,
          confidence: shapeInfo.confidence
        });
      }

      // Note: In @u4/opencv4nodejs v7.1.2, Mat objects are garbage collected automatically
      // No manual cleanup needed with .delete()

      // Sort by confidence and area
      results.sort((a, b) => (b.confidence * Math.log(b.area)) - (a.confidence * Math.log(a.area)));

      return results;

    } catch (error) {
      this.logger.error('Contour detection failed:', error.message);
      return [];
    }
  }

  /**
   * Find rectangular UI elements (buttons, input fields, panels)
   */
  async findRectangularElements(image: any, options: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  } = {}): Promise<ContourResult[]> {
    const {
      minWidth = 20,
      maxWidth = 800,
      minHeight = 15,
      maxHeight = 200
    } = options;

    const contourOptions: ContourOptions = {
      minArea: minWidth * minHeight,
      maxArea: maxWidth * maxHeight,
      minAspectRatio: minWidth / maxHeight,
      maxAspectRatio: maxWidth / minHeight,
      shapeTypes: ['rectangle']
    };

    return this.findElementsByShape(image, contourOptions);
  }

  /**
   * Find circular UI elements (buttons, icons, checkboxes)
   */
  async findCircularElements(image: any, options: {
    minRadius?: number;
    maxRadius?: number;
  } = {}): Promise<ContourResult[]> {
    const {
      minRadius = 10,
      maxRadius = 100
    } = options;

    const contourOptions: ContourOptions = {
      minArea: Math.PI * minRadius * minRadius,
      maxArea: Math.PI * maxRadius * maxRadius,
      minAspectRatio: 0.8,
      maxAspectRatio: 1.25,
      shapeTypes: ['circle']
    };

    return this.findElementsByShape(image, contourOptions);
  }

  /**
   * Classify shape based on contour approximation
   */
  private classifyShape(
    approxPoly: any,
    contour: any,
    boundingRect: any
  ): { shape: string; confidence: number } {
    const vertices = approxPoly.length;

    try {
      // Calculate additional metrics for shape classification
      const area = contour.area;
      const perimeter = contour.arcLength(true);
      const rectArea = boundingRect.width * boundingRect.height;
      const extent = area / rectArea;

      // Circularity metric
      const circularity = (4 * Math.PI * area) / (perimeter * perimeter);

      if (vertices === 3) {
        return { shape: 'triangle', confidence: 0.9 };
      } else if (vertices === 4) {
        // Check if it's a rectangle/square
        const aspectRatio = boundingRect.width / boundingRect.height;
        const confidence = extent > 0.85 ? 0.9 : 0.7;

        if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
          return { shape: 'square', confidence };
        } else {
          return { shape: 'rectangle', confidence };
        }
      } else if (vertices >= 8 && circularity > 0.7) {
        // Likely a circle
        const confidence = Math.min(0.95, circularity);
        return { shape: 'circle', confidence };
      } else if (vertices >= 5) {
        // Polygon
        const confidence = Math.max(0.5, 1.0 - (vertices - 5) * 0.1);
        return { shape: 'polygon', confidence };
      }

      // Default classification
      return { shape: 'unknown', confidence: 0.3 };

    } catch (error) {
      this.logger.warn('Shape classification failed:', error.message);
      return { shape: 'unknown', confidence: 0.1 };
    }
  }
}