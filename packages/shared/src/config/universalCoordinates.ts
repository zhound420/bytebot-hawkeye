import { access, readFile } from 'fs/promises';
import path from 'path';

export type UniversalCoordinatesConfig = unknown;

export interface LoadUniversalCoordinatesOptions {
  /**
   * Additional candidate file paths to check before the defaults.
   * Relative paths are resolved against `cwd` (or `process.cwd()` when omitted).
   */
  candidates?: string[];
  /**
   * Base directory used to resolve relative paths supplied via `candidates`.
   * Defaults to the current working directory at call time.
   */
  cwd?: string;
}

type ErrnoException = Error & { code?: string };

type ProcessLike = {
  cwd(): string;
  env?: Record<string, string | undefined>;
};

const DEFAULT_RELATIVE_PATHS = [
  path.join('config', 'universal-coordinates.json'),
  'universal-coordinates.json',
];

function getProcess(): ProcessLike {
  const processLike = (globalThis as { process?: ProcessLike }).process;
  if (!processLike) {
    throw new Error('Process is not available in this environment.');
  }
  return processLike;
}

function normaliseCandidates(candidates: string[] = [], cwd: string): string[] {
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate) continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const resolved = path.isAbsolute(trimmed)
      ? path.normalize(trimmed)
      : path.normalize(path.join(cwd, trimmed));
    if (!seen.has(resolved)) {
      seen.add(resolved);
    }
  }

  return Array.from(seen);
}

function buildSearchPaths(
  options: LoadUniversalCoordinatesOptions = {},
): string[] {
  const nodeProcess = getProcess();
  const cwd = options.cwd ?? nodeProcess.cwd();
  const envPath = nodeProcess.env?.BYTEBOT_UNIVERSAL_COORDINATES_PATH;

  const explicit = normaliseCandidates(options.candidates, cwd);
  const environment = envPath ? normaliseCandidates([envPath], cwd) : [];
  const defaults = normaliseCandidates(DEFAULT_RELATIVE_PATHS, cwd);

  return [...explicit, ...environment, ...defaults];
}

export async function findUniversalCoordinatesPath(
  options: LoadUniversalCoordinatesOptions = {},
): Promise<string | null> {
  const searchPaths = buildSearchPaths(options);

  for (const candidate of searchPaths) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      const err = error as ErrnoException;
      if (err.code === 'ENOENT') {
        continue;
      }
      throw new Error(
        `Unable to access universal coordinate file at "${candidate}": ${err.message}`,
      );
    }
  }

  return null;
}

export async function loadUniversalCoordinates<T = UniversalCoordinatesConfig>(
  options: LoadUniversalCoordinatesOptions = {},
): Promise<T> {
  const searchPaths = buildSearchPaths(options);
  const errors: Error[] = [];

  for (const candidate of searchPaths) {
    try {
      const fileContents = await readFile(candidate, 'utf8');
      return JSON.parse(fileContents) as T;
    } catch (error) {
      const err = error as ErrnoException;
      if (err.code === 'ENOENT') {
        errors.push(
          new Error(`Universal coordinate file not found at "${candidate}"`),
        );
        continue;
      }

      throw new Error(
        `Failed to load universal coordinate file at "${candidate}": ${err.message}`,
      );
    }
  }

  if (errors.length > 0) {
    const messageLines = errors.map((err) => `  - ${err.message}`);
    throw new Error(
      [
        'Unable to locate a universal coordinate configuration file.',
        'Checked the following paths:',
        ...messageLines,
        'Set BYTEBOT_UNIVERSAL_COORDINATES_PATH or provide an explicit path via options.',
      ].join('\n'),
    );
  }

  throw new Error(
    'No universal coordinate configuration paths were provided to search.',
  );
}

export function getDefaultUniversalCoordinatePaths(
  cwd: string = getProcess().cwd(),
): string[] {
  return normaliseCandidates(DEFAULT_RELATIVE_PATHS, cwd);
}
