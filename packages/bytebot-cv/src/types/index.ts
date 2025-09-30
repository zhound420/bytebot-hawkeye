export interface DetectedElement {
  id: string;
  type: ElementType;
  coordinates: BoundingBox;
  confidence: number;
  text?: string;
  description: string;
  metadata: ElementMetadata;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface ElementMetadata {
  detectionMethod: 'ocr' | 'template' | 'edge' | 'accessibility' | 'hybrid' | 'template-matching' | 'feature-matching' | 'contour-detection' | 'ocr-detection';
  similarity?: number;
  ocrConfidence?: number;
  templateMatch?: number;
  ocrAttempt?: string;
  // Enhanced CV metadata
  originalResult?: any;
  shape?: string;
  area?: number;
  aspectRatio?: number;
  keypointCount?: number;
  combinedFromMethods?: string[];
}

export type ElementType =
  | 'button'
  | 'input'
  | 'link'
  | 'text'
  | 'icon'
  | 'dropdown'
  | 'checkbox'
  | 'unknown';

export interface DetectionConfig {
  enableOCR: boolean;
  enableTemplateMatching: boolean;
  enableEdgeDetection: boolean;
  confidenceThreshold: number;
  searchRegion?: BoundingBox;
}

export interface ClickTarget {
  coordinates: { x: number; y: number };
  confidence: number;
  method: string;
  fallbackCoordinates?: { x: number; y: number }[];
}
