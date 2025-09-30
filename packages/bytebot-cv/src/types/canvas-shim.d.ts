declare module 'canvas' {
  export function createCanvas(width: number, height: number): {
    getContext(type: '2d'): {
      drawImage(image: any, x: number, y: number): void;
      getImageData(x: number, y: number, width: number, height: number): {
        data: Uint8ClampedArray;
        width: number;
        height: number;
      };
      putImageData(imageData: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number): void;
    };
    toBuffer(type?: string): Buffer;
    width: number;
    height: number;
  };

  export function loadImage(data: Buffer | string): Promise<{
    width: number;
    height: number;
  }>;
}
