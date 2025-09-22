import * as fs from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

const CONFIG_FILE_NAME = 'universal-coordinates.yaml';
const CONFIG_RELATIVE_PATH = join('config', CONFIG_FILE_NAME);

type SearchResult = string | null;

const searchUpwards = (start: string): SearchResult => {
  let current = resolve(start);
  const visited = new Set<string>();

  while (!visited.has(current)) {
    visited.add(current);

    const candidate = join(current, CONFIG_RELATIVE_PATH);
    if (fs.existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return null;
};

const resolveOverridePath = (candidate: string): string => {
  const resolvedPath = isAbsolute(candidate)
    ? candidate
    : resolve(process.cwd(), candidate);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `BYTEBOT_COORDINATE_CONFIG points to \"${candidate}\" but the file was not found.`,
    );
  }

  return resolvedPath;
};

export const resolveConfigPath = (): string => {
  const override = process.env.BYTEBOT_COORDINATE_CONFIG;
  if (override && override.trim().length > 0) {
    return resolveOverridePath(override.trim());
  }

  const searchOrigins = [process.cwd(), __dirname];
  const checked = new Set<string>();

  for (const origin of searchOrigins) {
    const resolvedOrigin = resolve(origin);
    if (checked.has(resolvedOrigin)) {
      continue;
    }

    checked.add(resolvedOrigin);
    const discovered = searchUpwards(resolvedOrigin);
    if (discovered) {
      return discovered;
    }
  }

  throw new Error(
    'Unable to locate config/universal-coordinates.yaml. Set BYTEBOT_COORDINATE_CONFIG to override the search location.',
  );
};

export const readUniversalCoordinateConfig = (): string => {
  const configPath = resolveConfigPath();
  return fs.readFileSync(configPath, 'utf8');
};

export const UNIVERSAL_COORDINATE_CONFIG_PATH = CONFIG_RELATIVE_PATH;
