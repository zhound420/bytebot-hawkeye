import { Injectable, Logger } from '@nestjs/common';
import { getOpenCvModule, hasOpenCv } from '../../utils/opencv-loader';

const cv = getOpenCvModule();

export interface TemplateMatchResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  method: string;
}

export interface TemplateMatchOptions {
  method?: number; // cv.TM_CCOEFF_NORMED, etc.
  threshold?: number; // Minimum confidence (0-1)
  maxMatches?: number; // Maximum number of matches to return
  scaleFactors?: number[]; // Multi-scale matching
}

@Injectable()
export class TemplateMatcherService {
  private readonly logger = new Logger(TemplateMatcherService.name);

  constructor() {
    this.logger.log('Template Matcher Service initialized');
  }

  /**
   * Find UI elements using template matching
   * Essential for finding buttons, icons, UI patterns on screen
   */
  async findMatches(
    screenshot: any, // Mat-like object
    template: any,   // Mat-like object
    options: TemplateMatchOptions = {}
  ): Promise<TemplateMatchResult[]> {
    if (!hasOpenCv || !screenshot || !template) {
      this.logger.warn('Template matching unavailable: missing OpenCV or inputs');
      return [];
    }

    const {
      method = cv.TM_CCOEFF_NORMED,
      threshold = 0.8,
      maxMatches = 10,
      scaleFactors = [1.0]
    } = options;

    const results: TemplateMatchResult[] = [];

    try {
      for (const scale of scaleFactors) {
        const scaledTemplate = scale !== 1.0
          ? template.resize(
              Math.round(template.cols * scale),
              Math.round(template.rows * scale)
            )
          : template;

        // Use Mat instance method (global cv.matchTemplate not available)
        const matchResult = screenshot.matchTemplate(scaledTemplate, method);

        // Find locations above threshold
        const locations = this.findPeaks(matchResult, threshold, maxMatches);

        for (const loc of locations) {
          results.push({
            x: loc.x,
            y: loc.y,
            width: Math.round(scaledTemplate.cols / scale),
            height: Math.round(scaledTemplate.rows / scale),
            confidence: loc.confidence,
            method: this.getMethodName(method)
          });
        }

        // Note: In @u4/opencv4nodejs v7.1.2, Mat objects are garbage collected automatically
      }

      // Sort by confidence and limit results
      results.sort((a, b) => b.confidence - a.confidence);
      return results.slice(0, maxMatches);

    } catch (error) {
      this.logger.error('Template matching failed:', error.message);
      return [];
    }
  }

  /**
   * Find button/icon by template with preprocessing for better accuracy
   */
  async findUIElement(
    screenshot: any,
    template: any,
    options: TemplateMatchOptions & {
      preprocessScreenshot?: boolean;
      preprocessTemplate?: boolean;
    } = {}
  ): Promise<TemplateMatchResult[]> {
    const {
      preprocessScreenshot = true,
      preprocessTemplate = true,
      ...matchOptions
    } = options;

    try {
      let processedScreenshot = screenshot;
      let processedTemplate = template;

      // Preprocess for better matching
      if (preprocessScreenshot) {
        processedScreenshot = this.preprocessForMatching(screenshot);
      }
      if (preprocessTemplate) {
        processedTemplate = this.preprocessForMatching(template);
      }

      const results = await this.findMatches(
        processedScreenshot,
        processedTemplate,
        matchOptions
      );

      // Note: In @u4/opencv4nodejs v7.1.2, Mat objects are garbage collected automatically
      // No manual cleanup needed with .delete()

      return results;

    } catch (error) {
      this.logger.error('UI element detection failed:', error.message);
      return [];
    }
  }

  /**
   * Preprocess image for better template matching
   */
  private preprocessForMatching(image: any): any {
    try {
      // Convert to grayscale for better matching
      const gray = image.channels === 3 ? image.cvtColor(cv.COLOR_BGR2GRAY) : image;

      // Apply slight blur to reduce noise
      const blurred = gray.gaussianBlur(new cv.Size(3, 3), 0);

      return blurred;
    } catch (error) {
      this.logger.warn('Preprocessing failed, using original:', error.message);
      return image;
    }
  }

  /**
   * Find peak locations in match result matrix
   */
  private findPeaks(matchResult: any, threshold: number, maxPeaks: number): Array<{x: number, y: number, confidence: number}> {
    const peaks: Array<{x: number, y: number, confidence: number}> = [];

    try {
      // Convert matchResult to accessible format
      const width = matchResult.cols;
      const height = matchResult.rows;

      // Simple peak detection - could be enhanced with non-maximum suppression
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const confidence = matchResult.at(y, x);

          if (confidence >= threshold) {
            peaks.push({ x, y, confidence });
          }
        }
      }

      // Sort by confidence and return top peaks
      peaks.sort((a, b) => b.confidence - a.confidence);
      return peaks.slice(0, maxPeaks);

    } catch (error) {
      this.logger.warn('Peak detection failed:', error.message);
      return [];
    }
  }

  /**
   * Get human-readable method name
   */
  private getMethodName(method: number): string {
    const methodNames: Record<number, string> = {
      [cv.TM_SQDIFF]: 'TM_SQDIFF',
      [cv.TM_SQDIFF_NORMED]: 'TM_SQDIFF_NORMED',
      [cv.TM_CCORR]: 'TM_CCORR',
      [cv.TM_CCORR_NORMED]: 'TM_CCORR_NORMED',
      [cv.TM_CCOEFF]: 'TM_CCOEFF',
      [cv.TM_CCOEFF_NORMED]: 'TM_CCOEFF_NORMED'
    };

    return methodNames[method] || `Unknown(${method})`;
  }
}