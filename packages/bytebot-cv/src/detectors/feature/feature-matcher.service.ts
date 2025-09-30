import { Injectable, Logger } from '@nestjs/common';
import { getOpenCvModule, hasOpenCv } from '../../utils/opencv-loader';

const cv = getOpenCvModule();

export interface FeatureMatchResult {
  x: number;
  y: number;
  confidence: number;
  keypointCount: number;
  method: string;
}

export interface FeatureMatchOptions {
  detector?: 'ORB' | 'AKAZE' | 'SIFT' | 'SURF';
  maxFeatures?: number;
  matchThreshold?: number;
  ransacThreshold?: number;
}

@Injectable()
export class FeatureMatcherService {
  private readonly logger = new Logger(FeatureMatcherService.name);

  constructor() {
    this.logger.log('Feature Matcher Service initialized');
  }

  /**
   * Find UI elements using feature matching (ORB, AKAZE)
   * Better for finding elements that may have slight variations
   */
  async findFeatureMatches(
    screenshot: any,
    template: any,
    options: FeatureMatchOptions = {}
  ): Promise<FeatureMatchResult[]> {
    if (!hasOpenCv || !screenshot || !template) {
      this.logger.warn('Feature matching unavailable: missing OpenCV or inputs');
      return [];
    }

    const {
      detector = 'ORB',
      maxFeatures = 1000,
      matchThreshold = 0.75,
      ransacThreshold = 5.0
    } = options;

    try {
      // Convert to grayscale for feature detection
      const grayScreenshot = screenshot.channels === 3
        ? screenshot.cvtColor(cv.COLOR_BGR2GRAY)
        : screenshot;
      const grayTemplate = template.channels === 3
        ? template.cvtColor(cv.COLOR_BGR2GRAY)
        : template;

      // Create feature detector based on availability
      let keypoints1, descriptors1, keypoints2, descriptors2;

      if (detector === 'ORB' && cv.ORBDetector) {
        const orb = new cv.ORBDetector(maxFeatures);
        const result1 = orb.detectAndCompute(grayTemplate);
        const result2 = orb.detectAndCompute(grayScreenshot);

        keypoints1 = result1.keypoints;
        descriptors1 = result1.descriptors;
        keypoints2 = result2.keypoints;
        descriptors2 = result2.descriptors;
      } else if (detector === 'AKAZE' && cv.AKAZEDetector) {
        const akaze = new cv.AKAZEDetector();
        const result1 = akaze.detectAndCompute(grayTemplate);
        const result2 = akaze.detectAndCompute(grayScreenshot);

        keypoints1 = result1.keypoints;
        descriptors1 = result1.descriptors;
        keypoints2 = result2.keypoints;
        descriptors2 = result2.descriptors;
      } else {
        this.logger.warn(`Feature detector ${detector} not available, using fallback`);
        return [];
      }

      if (!keypoints1.length || !keypoints2.length || !descriptors1 || !descriptors2) {
        this.logger.debug('Insufficient features detected for matching');
        return [];
      }

      // Match features using BFMatcher
      const matcher = new cv.BFMatcher();
      const matches = matcher.match(descriptors1, descriptors2);

      if (matches.length < 4) {
        this.logger.debug('Insufficient matches for homography calculation');
        return [];
      }

      // Filter good matches
      const goodMatches = matches.filter(match => match.distance < matchThreshold * 255);

      if (goodMatches.length < 4) {
        this.logger.debug('Insufficient good matches after filtering');
        return [];
      }

      // Extract matched points
      const srcPoints = goodMatches.map(match => keypoints1[match.queryIdx].pt);
      const dstPoints = goodMatches.map(match => keypoints2[match.trainIdx].pt);

      // Find homography using RANSAC
      const homography = cv.findHomography(srcPoints, dstPoints, {
        method: cv.RANSAC,
        ransacReprojThreshold: ransacThreshold
      });

      if (!homography || homography.empty) {
        this.logger.debug('Could not compute valid homography');
        return [];
      }

      // Transform template corners to find location in screenshot
      const templateCorners = [
        new cv.Point2(0, 0),
        new cv.Point2(template.cols, 0),
        new cv.Point2(template.cols, template.rows),
        new cv.Point2(0, template.rows)
      ];

      const transformedCorners = cv.perspectiveTransform(templateCorners, homography);

      // Calculate bounding box and confidence
      const boundingRect = cv.boundingRect(transformedCorners);
      const confidence = goodMatches.length / Math.max(keypoints1.length, keypoints2.length);

      // Note: In @u4/opencv4nodejs v7.1.2, Mat objects are garbage collected automatically
      // No manual cleanup needed with .delete()

      return [{
        x: boundingRect.x,
        y: boundingRect.y,
        confidence,
        keypointCount: goodMatches.length,
        method: detector
      }];

    } catch (error) {
      this.logger.error('Feature matching failed:', error.message);
      return [];
    }
  }

  /**
   * Detect keypoints for analysis without matching
   * Useful for determining if an element has sufficient features for matching
   */
  async analyzeFeatures(image: any, detector: string = 'ORB'): Promise<{
    keypointCount: number;
    avgResponse: number;
    detector: string;
  }> {
    if (!hasOpenCv || !image) {
      return { keypointCount: 0, avgResponse: 0, detector };
    }

    try {
      const gray = image.channels === 3 ? image.cvtColor(cv.COLOR_BGR2GRAY) : image;
      let keypoints = [];

      if (detector === 'ORB' && cv.ORBDetector) {
        const orb = new cv.ORBDetector(500);
        keypoints = orb.detect(gray);
      } else if (detector === 'AKAZE' && cv.AKAZEDetector) {
        const akaze = new cv.AKAZEDetector();
        keypoints = akaze.detect(gray);
      }

      const avgResponse = keypoints.length > 0
        ? keypoints.reduce((sum, kp) => sum + kp.response, 0) / keypoints.length
        : 0;

      // Note: In @u4/opencv4nodejs v7.1.2, Mat objects are garbage collected automatically

      return {
        keypointCount: keypoints.length,
        avgResponse,
        detector
      };

    } catch (error) {
      this.logger.warn('Feature analysis failed:', error.message);
      return { keypointCount: 0, avgResponse: 0, detector };
    }
  }
}