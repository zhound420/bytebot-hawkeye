export type UniversalElementType = 'button' | 'text_input' | 'clickable' | 'menu_item';
export type UniversalDetectionMethod = 'visual' | 'text' | 'hybrid';

export interface UniversalUIElement {
  id: string;
  type: UniversalElementType;
  bounds: { x: number; y: number; width: number; height: number };
  clickPoint: { x: number; y: number };
  confidence: number;
  text?: string;
  semanticRole?: string;
  description: string;
}

export interface DetectionResult {
  elements: UniversalUIElement[];
  processingTime: number;
  method: UniversalDetectionMethod;
}
