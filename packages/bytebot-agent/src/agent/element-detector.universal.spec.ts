import {
  ElementDetectorService,
  UniversalUIElement,
  UniversalDetectorService,
} from '@bytebot/cv';

describe('ElementDetectorService detectElementsUniversal', () => {
  const baseElement = (): UniversalUIElement => ({
    id: 'element-1',
    type: 'button',
    bounds: { x: 10, y: 20, width: 100, height: 30 },
    clickPoint: { x: 60, y: 35 },
    confidence: 0.8,
    description: 'synthetic button',
  });

  it('delegates to UniversalDetectorService when provided', async () => {
    const expectedElements = [{ ...baseElement(), text: 'Install' }];
    const detectElements = jest.fn().mockResolvedValue({
      elements: expectedElements,
      processingTime: 5,
      method: 'hybrid' as const,
    });

    const service = new ElementDetectorService({
      detectElements,
    } as unknown as UniversalDetectorService);

    const result = await service.detectElementsUniversal(Buffer.from('synthetic'));

    expect(detectElements).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expectedElements);
  });

  it('falls back to OCR-only universal detection when universal service missing', async () => {
    const fallbackElements = [{ ...baseElement(), text: undefined }];

    class FallbackDetector extends ElementDetectorService {
      constructor() {
        super(undefined);
      }

      // eslint-disable-next-line class-methods-use-this
      async detectUniversalElements() {
        return {
          elements: fallbackElements,
          processingTime: 3,
          method: 'visual' as const,
        };
      }
    }

    const service = new FallbackDetector();
    const result = await service.detectElementsUniversal(Buffer.from('synthetic'));

    expect(result).toEqual([
      {
        ...fallbackElements[0],
        text: '',
      },
    ]);
  });
});
