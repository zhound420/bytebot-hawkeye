import { Injectable, Logger } from '@nestjs/common';
import { TemplateMatcherService } from '../detectors/template/template-matcher.service';
import { FeatureMatcherService } from '../detectors/feature/feature-matcher.service';
import { ContourDetectorService } from '../detectors/contour/contour-detector.service';
import { OCRDetector } from '../detectors/ocr/ocr-detector';
import { CVActivityIndicatorService } from './cv-activity-indicator.service';
import { getOpenCvModule, hasOpenCv } from '../utils/opencv-loader';
import { DetectedElement, BoundingBox } from '../types';

const cv = getOpenCvModule();

export interface EnhancedDetectionOptions {
  useTemplateMatching?: boolean;
  useFeatureMatching?: boolean;
  useContourDetection?: boolean;
  useOCR?: boolean;

  // Template matching options
  templateThreshold?: number;
  scaleFactors?: number[];

  // Feature matching options
  featureDetector?: 'ORB' | 'AKAZE';
  maxFeatures?: number;

  // Contour detection options
  minArea?: number;
  maxArea?: number;
  shapeTypes?: ('rectangle' | 'circle' | 'triangle' | 'polygon')[];

  // OCR options
  ocrRegion?: BoundingBox;

  // General options
  confidenceThreshold?: number;
  maxResults?: number;
  combineResults?: boolean;
}

export interface EnhancedDetectionResult {
  elements: DetectedElement[];
  methodsUsed: string[];
  performance: {
    totalTime: number;
    templateMatchingTime?: number;
    featureMatchingTime?: number;
    contourDetectionTime?: number;
    ocrTime?: number;
  };
  confidence: number;
}

@Injectable()
export class EnhancedVisualDetectorService {
  private readonly logger = new Logger(EnhancedVisualDetectorService.name);
  private readonly ocrDetector: OCRDetector;

  constructor(
    private readonly templateMatcher: TemplateMatcherService,
    private readonly featureMatcher: FeatureMatcherService,
    private readonly contourDetector: ContourDetectorService,
    private readonly cvActivity: CVActivityIndicatorService,
  ) {
    this.ocrDetector = new OCRDetector();
    this.logger.log('Enhanced Visual Detector Service initialized');
  }

  /**
   * Comprehensive UI element detection using multiple CV methods
   * The gold standard for finding UI elements
   */
  async detectElements(
    screenshot: any,
    template: any | Buffer,
    options: EnhancedDetectionOptions = {}
  ): Promise<EnhancedDetectionResult> {
    if (!hasOpenCv || !screenshot) {
      this.logger.warn('Enhanced detection unavailable: missing OpenCV or screenshot');
      return this.createEmptyResult();
    }

    const startTime = Date.now();
    const methodsUsed: string[] = [];
    const allElements: DetectedElement[] = [];
    const performance: any = {};

    const {
      useTemplateMatching = true,
      useFeatureMatching = true,
      useContourDetection = true,
      useOCR = false, // OCR is expensive, opt-in
      confidenceThreshold = 0.6,
      maxResults = 20,
      combineResults = true
    } = options;

    try {
      // Template Matching
      if (useTemplateMatching && template) {
        const templateStart = Date.now();
        const templateResults = await this.runTemplateMatching(screenshot, template, options);
        performance.templateMatchingTime = Date.now() - templateStart;

        if (templateResults.length > 0) {
          methodsUsed.push('template-matching');
          allElements.push(...this.convertToDetectedElements(templateResults, 'template-matching'));
        }
      }

      // Feature Matching
      if (useFeatureMatching && template) {
        const featureStart = Date.now();
        const featureResults = await this.runFeatureMatching(screenshot, template, options);
        performance.featureMatchingTime = Date.now() - featureStart;

        if (featureResults.length > 0) {
          methodsUsed.push('feature-matching');
          allElements.push(...this.convertToDetectedElements(featureResults, 'feature-matching'));
        }
      }

      // Contour Detection
      if (useContourDetection) {
        const contourStart = Date.now();
        const contourResults = await this.runContourDetection(screenshot, options);
        performance.contourDetectionTime = Date.now() - contourStart;

        if (contourResults.length > 0) {
          methodsUsed.push('contour-detection');
          allElements.push(...this.convertContourToDetectedElements(contourResults));
        }
      }

      // OCR Detection
      if (useOCR) {
        const ocrStart = Date.now();
        const ocrResults = await this.runOCRDetection(screenshot, options);
        performance.ocrTime = Date.now() - ocrStart;

        if (ocrResults.length > 0) {
          methodsUsed.push('ocr');
          allElements.push(...ocrResults);
        }
      }

      // Process results
      const filteredElements = allElements.filter(el => el.confidence >= confidenceThreshold);
      const finalElements = combineResults
        ? this.combineOverlappingElements(filteredElements)
        : filteredElements;

      // Sort by confidence and limit results
      finalElements.sort((a, b) => b.confidence - a.confidence);
      const limitedElements = finalElements.slice(0, maxResults);

      performance.totalTime = Date.now() - startTime;

      const avgConfidence = limitedElements.length > 0
        ? limitedElements.reduce((sum, el) => sum + el.confidence, 0) / limitedElements.length
        : 0;

      return {
        elements: limitedElements,
        methodsUsed,
        performance,
        confidence: avgConfidence
      };

    } catch (error) {
      this.logger.error('Enhanced detection failed:', error.message);
      return this.createEmptyResult();
    }
  }

  /**
   * Quick UI element detection using the most reliable methods
   * Optimized for speed over comprehensiveness
   */
  async quickDetectElements(
    screenshot: any,
    options: Partial<EnhancedDetectionOptions> = {}
  ): Promise<EnhancedDetectionResult> {
    return this.detectElements(screenshot, null, {
      useTemplateMatching: false,
      useFeatureMatching: false,
      useContourDetection: true,
      useOCR: false,
      maxResults: 10,
      ...options
    });
  }

  /**
   * Specialized button detection using optimal methods
   */
  async detectButtons(screenshot: any): Promise<EnhancedDetectionResult> {
    const contourOptions = {
      minArea: 100,
      maxArea: 10000,
      minAspectRatio: 0.2,
      maxAspectRatio: 8.0,
      shapeTypes: ['rectangle', 'circle'] as ('rectangle' | 'circle' | 'triangle' | 'polygon')[]
    };

    return this.detectElements(screenshot, null, {
      useContourDetection: true,
      useOCR: true, // OCR helps identify button text
      useTemplateMatching: false,
      useFeatureMatching: false,
      ...contourOptions
    });
  }

  private async runTemplateMatching(screenshot: any, template: any, options: EnhancedDetectionOptions) {
    return this.cvActivity.executeWithTracking(
      'template-matching',
      async () => {
        const templateMat = Buffer.isBuffer(template)
          ? cv.imdecode(template)
          : template;

        return await this.templateMatcher.findMatches(screenshot, templateMat, {
          threshold: options.templateThreshold || 0.8,
          scaleFactors: options.scaleFactors || [1.0, 0.8, 1.2],
          maxMatches: 10
        });
      },
      {
        threshold: options.templateThreshold || 0.8,
        scaleFactors: options.scaleFactors || [1.0, 0.8, 1.2]
      }
    ).catch(error => {
      this.logger.warn('Template matching failed:', error.message);
      return [];
    });
  }

  private async runFeatureMatching(screenshot: any, template: any, options: EnhancedDetectionOptions) {
    return this.cvActivity.executeWithTracking(
      'feature-matching',
      async () => {
        const templateMat = Buffer.isBuffer(template)
          ? cv.imdecode(template)
          : template;

        return await this.featureMatcher.findFeatureMatches(screenshot, templateMat, {
          detector: options.featureDetector || 'ORB',
          maxFeatures: options.maxFeatures || 1000,
          matchThreshold: 0.75
        });
      },
      {
        detector: options.featureDetector || 'ORB',
        maxFeatures: options.maxFeatures || 1000
      }
    ).catch(error => {
      this.logger.warn('Feature matching failed:', error.message);
      return [];
    });
  }

  private async runContourDetection(screenshot: any, options: EnhancedDetectionOptions) {
    return this.cvActivity.executeWithTracking(
      'contour-detection',
      async () => {
        return await this.contourDetector.findElementsByShape(screenshot, {
          minArea: options.minArea || 100,
          maxArea: options.maxArea || 50000,
          shapeTypes: options.shapeTypes || ['rectangle', 'circle']
        });
      },
      {
        minArea: options.minArea || 100,
        maxArea: options.maxArea || 50000,
        shapeTypes: options.shapeTypes || ['rectangle', 'circle']
      }
    ).catch(error => {
      this.logger.warn('Contour detection failed:', error.message);
      return [];
    });
  }

  private async runOCRDetection(screenshot: any, options: EnhancedDetectionOptions) {
    return this.cvActivity.executeWithTracking(
      'ocr-detection',
      async () => {
        // Convert Mat to Buffer for OCR
        const encoded = cv.imencode('.png', screenshot);
        return await this.ocrDetector.detect(encoded, options.ocrRegion);
      },
      {
        region: options.ocrRegion ? `${options.ocrRegion.width}x${options.ocrRegion.height}` : 'full-screen'
      }
    ).catch(error => {
      this.logger.warn('OCR detection failed:', error.message);
      return [];
    });
  }

  private convertToDetectedElements(results: any[], method: string): DetectedElement[] {
    return results.map((result, index) => ({
      id: `${method}_${Date.now()}_${index}`,
      type: this.inferElementType(result),
      coordinates: {
        x: result.x,
        y: result.y,
        width: result.width || 10,
        height: result.height || 10,
        centerX: result.x + (result.width || 10) / 2,
        centerY: result.y + (result.height || 10) / 2,
      },
      confidence: result.confidence || 0.5,
      text: result.text || '',
      description: `Element detected by ${method}`,
      metadata: {
        detectionMethod: method as 'template-matching' | 'feature-matching' | 'ocr-detection',
        originalResult: result
      }
    }));
  }

  private convertContourToDetectedElements(results: any[]): DetectedElement[] {
    return results.map((result, index) => ({
      id: `contour_${Date.now()}_${index}`,
      type: this.mapShapeToElementType(result.shape),
      coordinates: {
        x: result.x,
        y: result.y,
        width: result.width,
        height: result.height,
        centerX: result.x + result.width / 2,
        centerY: result.y + result.height / 2,
      },
      confidence: result.confidence,
      text: '',
      description: `${result.shape} element (area: ${result.area})`,
      metadata: {
        detectionMethod: 'contour-detection' as const,
        shape: result.shape,
        area: result.area,
        aspectRatio: result.aspectRatio
      }
    }));
  }

  private inferElementType(result: any): 'button' | 'input' | 'link' | 'text' | 'icon' {
    // Basic heuristics for element type inference
    if (result.confidence > 0.8) return 'button';
    if (result.width > 100 && result.height < 40) return 'input';
    return 'button'; // Default to button for UI automation
  }

  private mapShapeToElementType(shape: string): 'button' | 'input' | 'link' | 'text' | 'icon' {
    switch (shape) {
      case 'circle': return 'button';
      case 'rectangle':
      case 'square': return 'button';
      default: return 'icon';
    }
  }

  private combineOverlappingElements(elements: DetectedElement[]): DetectedElement[] {
    const combined: DetectedElement[] = [];
    const used = new Set<number>();

    for (let i = 0; i < elements.length; i++) {
      if (used.has(i)) continue;

      const base = elements[i];
      const overlapping = [base];

      for (let j = i + 1; j < elements.length; j++) {
        if (used.has(j)) continue;

        if (this.elementsOverlap(base, elements[j])) {
          overlapping.push(elements[j]);
          used.add(j);
        }
      }

      // Create combined element with best properties from overlapping elements
      const bestElement = overlapping.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );

      // Merge metadata from all overlapping elements
      const allMethods = overlapping.map(el => el.metadata?.detectionMethod).filter(Boolean);
      bestElement.metadata = {
        ...bestElement.metadata,
        detectionMethod: 'hybrid' as const, // Use hybrid for combined detections
        combinedFromMethods: allMethods
      };

      combined.push(bestElement);
      used.add(i);
    }

    return combined;
  }

  private elementsOverlap(a: DetectedElement, b: DetectedElement): boolean {
    const overlapThreshold = 0.5;

    const aArea = a.coordinates.width * a.coordinates.height;
    const bArea = b.coordinates.width * b.coordinates.height;

    const overlapX = Math.max(0, Math.min(
      a.coordinates.x + a.coordinates.width,
      b.coordinates.x + b.coordinates.width
    ) - Math.max(a.coordinates.x, b.coordinates.x));

    const overlapY = Math.max(0, Math.min(
      a.coordinates.y + a.coordinates.height,
      b.coordinates.y + b.coordinates.height
    ) - Math.max(a.coordinates.y, b.coordinates.y));

    const overlapArea = overlapX * overlapY;
    const overlapRatio = overlapArea / Math.min(aArea, bArea);

    return overlapRatio > overlapThreshold;
  }

  private createEmptyResult(): EnhancedDetectionResult {
    return {
      elements: [],
      methodsUsed: [],
      performance: { totalTime: 0 },
      confidence: 0
    };
  }

  async cleanup(): Promise<void> {
    await this.ocrDetector.cleanup();
  }
}