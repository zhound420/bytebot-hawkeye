declare module 'node:fs' {
  const fs: {
    existsSync: (path: string) => boolean;
    readFileSync: (path: string, options: string) => string;
    mkdirSync: (path: string, options: { recursive: boolean }) => void;
    copyFileSync: (src: string, dest: string) => void;
  };
  export = fs;
}

declare module 'node:path' {
  const path: {
    resolve: (...segments: string[]) => string;
    join: (...segments: string[]) => string;
    dirname: (segment: string) => string;
    isAbsolute: (segment: string) => boolean;
  };
  export = path;
}

declare const __dirname: string;
declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};
