declare module 'fs/promises' {
  export function access(path: string, mode?: number): Promise<void>;
  export function readFile(
    path: string,
    options: { encoding: 'utf8' } | 'utf8',
  ): Promise<string>;
}

declare module 'path' {
  export function join(...parts: string[]): string;
  export function normalize(path: string): string;
  export function isAbsolute(path: string): boolean;
}
