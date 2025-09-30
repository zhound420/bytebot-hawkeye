import { Inject, Injectable, Logger, Optional, forwardRef } from '@nestjs/common';
import { VisualPatternDetectorService } from './visual-pattern-detector.service';
import { TextSemanticAnalyzerService } from './text-semantic-analyzer.service';
import { ElementDetectorService } from './element-detector.service';
import {
  UniversalUIElement,
  DetectionResult,
  UniversalElementType,
} from '../interfaces/universal-element.interface';
import { DetectedElement, BoundingBox } from '../types';

@Injectable()
export class UniversalDetectorService {
  private readonly logger = new Logger(UniversalDetectorService.name);

  constructor(
    private readonly visualDetector: VisualPatternDetectorService,
    private readonly textAnalyzer: TextSemanticAnalyzerService,
    @Optional()
    @Inject(forwardRef(() => ElementDetectorService))
    private readonly ocrService?: ElementDetectorService,
  ) {}

  async detectElements(screenshot: Buffer): Promise<DetectionResult> {
    const startTime = Date.now();

    try {
      const [buttons, inputs, ocrDetections] = await Promise.all([
        this.visualDetector.detectButtons(screenshot),
        this.visualDetector.detectTextInputs(screenshot),
        this.ocrService?.performOCR(screenshot) ?? Promise.resolve([]),
      ]);

      let visualElements = [...buttons, ...inputs];
      visualElements = this.enhanceWithOcrDetections(visualElements, ocrDetections);

      const textElements = this.detectClickableText(ocrDetections);
      const mergedElements = this.mergeAndDeduplicate([...visualElements, ...textElements]);

      const finalElements = mergedElements.map((element) => {
        const semanticRole = this.textAnalyzer.analyzeSemanticRole(element.text);
        const description = this.textAnalyzer.generateDescription({
          type: element.type,
          text: element.text,
          bounds: element.bounds,
          semanticRole,
        });

        return {
          ...element,
          semanticRole,
          description,
        };
      });

      const processingTime = Date.now() - startTime;
      this.logger.log(`Detected ${finalElements.length} universal element(s) in ${processingTime}ms`);

      return {
        elements: finalElements.filter((el) => el.confidence >= 0.5),
        processingTime,
        method: 'hybrid',
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Universal detection failed', (error as Error)?.stack);
      return {
        elements: [],
        processingTime,
        method: 'hybrid',
      };
    }
  }

  async findElementsByRole(screenshot: Buffer, role: string): Promise<UniversalUIElement[]> {
    const result = await this.detectElements(screenshot);
    return result.elements.filter((element) => element.semanticRole === role);
  }

  async findElementsByText(screenshot: Buffer, searchText: string): Promise<UniversalUIElement[]> {
    const result = await this.detectElements(screenshot);
    const search = searchText.toLowerCase();
    return result.elements.filter((element) => element.text?.toLowerCase().includes(search));
  }

  private enhanceWithOcrDetections(
    elements: UniversalUIElement[],
    ocrDetections: DetectedElement[],
  ): UniversalUIElement[] {
    if (elements.length === 0 || ocrDetections.length === 0) {
      return elements;
    }

    return elements.map((element) => {
      const match = this.findBestTextMatch(element.bounds, ocrDetections);
      if (!match?.text) {
        return element;
      }

      const text = match.text.trim();
      if (!text) {
        return element;
      }

      const boostedConfidence = Math.min(
        Math.max(element.confidence, 0.5) + (match.confidence ?? 0) * 0.2,
        0.98,
      );

      return {
        ...element,
        text,
        confidence: Math.max(element.confidence, boostedConfidence),
      };
    });
  }

  private findBestTextMatch(
    bounds: { x: number; y: number; width: number; height: number },
    detections: DetectedElement[],
  ): DetectedElement | null {
    let best: DetectedElement | null = null;
    let bestScore = 0;

    for (const detection of detections) {
      const detectionBounds = this.toBounds(detection.coordinates);
      const overlap = this.calculateOverlap(bounds, detectionBounds);
      if (overlap <= 0.25) {
        continue;
      }

      const score = overlap * (detection.confidence ?? 1);
      if (score > bestScore) {
        best = detection;
        bestScore = score;
      }
    }

    return best;
  }

  private detectClickableText(ocrDetections: DetectedElement[]): UniversalUIElement[] {
    const elements: UniversalUIElement[] = [];

    for (const detection of ocrDetections) {
      const text = detection.text?.trim();
      if (!text) {
        continue;
      }

      if (!this.textAnalyzer.isClickableText(text)) {
        continue;
      }

      const bounds = this.toBounds(detection.coordinates);
      const semanticRole = this.textAnalyzer.analyzeSemanticRole(text);
      const type: UniversalElementType =
        semanticRole === 'submit' || semanticRole === 'cancel' ? 'button' : 'clickable';

      const confidence = Math.min(0.55 + (detection.confidence ?? 0) * 0.4, 0.95);

      elements.push({
        id: `text_${detection.id}`,
        type,
        bounds,
        clickPoint: {
          x: Math.round(detection.coordinates.centerX),
          y: Math.round(detection.coordinates.centerY),
        },
        confidence,
        text,
        semanticRole,
        description: '',
      });
    }

    return elements;
  }

  private mergeAndDeduplicate(elements: UniversalUIElement[]): UniversalUIElement[] {
    const merged: UniversalUIElement[] = [];

    for (const element of elements) {
      const overlapping = merged.find(
        (candidate) => this.calculateOverlap(candidate.bounds, element.bounds) > 0.5,
      );

      if (overlapping) {
        if (element.confidence > overlapping.confidence) {
          const index = merged.indexOf(overlapping);
          merged[index] = element;
        }
      } else {
        merged.push(element);
      }
    }

    return merged;
  }

  private calculateOverlap(rect1: BoundingBox | { x: number; y: number; width: number; height: number }, rect2: { x: number; y: number; width: number; height: number }): number {
    const xOverlap = Math.max(0, Math.min(rect1.x + rect1.width, rect2.x + rect2.width) - Math.max(rect1.x, rect2.x));
    const yOverlap = Math.max(0, Math.min(rect1.y + rect1.height, rect2.y + rect2.height) - Math.max(rect1.y, rect2.y));
    const overlapArea = xOverlap * yOverlap;
    const minArea = Math.min(rect1.width * rect1.height, rect2.width * rect2.height);

    return minArea > 0 ? overlapArea / minArea : 0;
  }

  private toBounds(coordinates: BoundingBox): { x: number; y: number; width: number; height: number } {
    return {
      x: coordinates.x,
      y: coordinates.y,
      width: coordinates.width,
      height: coordinates.height,
    };
  }
}
