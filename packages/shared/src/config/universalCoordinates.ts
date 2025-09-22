import * as fs from 'fs';
import * as path from 'path';
import { load } from 'js-yaml';

export interface VisualGridConfig {
  gridSize: number;
  lineColor: string;
  lineOpacity: number;
  textColor: string;
  textOpacity: number;
  fontSize: number;
  lineWidth: number;
  showGlobalCoordinates: boolean;
}

export interface ZoomConfig {
  maxSteps: number;
  initialRegionSize: number;
  defaultFactor: number;
}

export interface ConfidenceConfig {
  aiThreshold: number;
  clickRetryThreshold: number;
  clickRetryMax: number;
}

export interface CalibrationConfig {
  window: number;
  delayMs: number;
  enablePostClick: boolean;
}

export interface UniversalCoordinatesConfig {
  visualTeaching: {
    overviewGrid: VisualGridConfig;
    zoomGrid: VisualGridConfig;
  };
  zoom: ZoomConfig;
  confidence: ConfidenceConfig;
  calibration: CalibrationConfig;
}

const DEFAULT_CONFIG: UniversalCoordinatesConfig = {
  visualTeaching: {
    overviewGrid: {
      gridSize: 100,
      lineColor: '#00FF00',
      lineOpacity: 0.4,
      textColor: '#00FF00',
      textOpacity: 0.8,
      fontSize: 12,
      lineWidth: 1,
      showGlobalCoordinates: true,
    },
    zoomGrid: {
      gridSize: 50,
      lineColor: '#00FFFF',
      lineOpacity: 0.4,
      textColor: '#00FFFF',
      textOpacity: 0.9,
      fontSize: 10,
      lineWidth: 1,
      showGlobalCoordinates: true,
    },
  },
  zoom: {
    maxSteps: 3,
    initialRegionSize: 600,
    defaultFactor: 2.0,
  },
  confidence: {
    aiThreshold: 0.8,
    clickRetryThreshold: 4.0,
    clickRetryMax: 1,
  },
  calibration: {
    window: 200,
    delayMs: 75,
    enablePostClick: true,
  },
};

let cachedConfig: UniversalCoordinatesConfig | null = null;

function resolveConfigPath(): string | null {
  const explicit = process.env.BYTEBOT_COORDINATE_CONFIG;
  if (explicit && explicit.trim()) {
    const explicitPath = path.resolve(explicit.trim());
    if (fs.existsSync(explicitPath)) {
      return explicitPath;
    }
  }

  const candidates = [
    path.resolve(process.cwd(), 'config/universal-coordinates.yaml'),
    path.resolve(__dirname, '../../config/universal-coordinates.yaml'),
    path.resolve(__dirname, '../../../config/universal-coordinates.yaml'),
    path.resolve(__dirname, '../../../../config/universal-coordinates.yaml'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') {
      return true;
    }
    if (normalized === 'false' || normalized === '0') {
      return false;
    }
  }
  return fallback;
}

function parseString(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return fallback;
}

function normaliseGridConfig(
  raw: any,
  fallback: VisualGridConfig,
): VisualGridConfig {
  return {
    gridSize: parseNumber(raw?.grid_size, fallback.gridSize),
    lineColor: parseString(raw?.line_color, fallback.lineColor),
    lineOpacity: parseNumber(raw?.line_opacity, fallback.lineOpacity),
    textColor: parseString(raw?.text_color, fallback.textColor),
    textOpacity: parseNumber(raw?.text_opacity, fallback.textOpacity),
    fontSize: parseNumber(raw?.font_size, fallback.fontSize),
    lineWidth: parseNumber(raw?.line_width, fallback.lineWidth),
    showGlobalCoordinates: parseBoolean(
      raw?.show_global_coordinates,
      fallback.showGlobalCoordinates,
    ),
  };
}

function loadFromDisk(): UniversalCoordinatesConfig {
  const pathToLoad = resolveConfigPath();
  if (!pathToLoad) {
    return DEFAULT_CONFIG;
  }

  try {
    const rawContents = fs.readFileSync(pathToLoad, 'utf8');
    const parsed = load(rawContents) as Record<string, any> | undefined;

    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_CONFIG;
    }

    const visualTeaching = parsed.visual_teaching ?? {};

    return {
      visualTeaching: {
        overviewGrid: normaliseGridConfig(
          visualTeaching.overview_grid,
          DEFAULT_CONFIG.visualTeaching.overviewGrid,
        ),
        zoomGrid: normaliseGridConfig(
          visualTeaching.zoom_grid,
          DEFAULT_CONFIG.visualTeaching.zoomGrid,
        ),
      },
      zoom: {
        maxSteps: parseNumber(
          parsed.zoom?.max_steps,
          DEFAULT_CONFIG.zoom.maxSteps,
        ),
        initialRegionSize: parseNumber(
          parsed.zoom?.initial_region_size,
          DEFAULT_CONFIG.zoom.initialRegionSize,
        ),
        defaultFactor: parseNumber(
          parsed.zoom?.default_factor,
          DEFAULT_CONFIG.zoom.defaultFactor,
        ),
      },
      confidence: {
        aiThreshold: parseNumber(
          parsed.confidence?.ai_threshold,
          DEFAULT_CONFIG.confidence.aiThreshold,
        ),
        clickRetryThreshold: parseNumber(
          parsed.confidence?.click_retry_threshold,
          DEFAULT_CONFIG.confidence.clickRetryThreshold,
        ),
        clickRetryMax: Math.round(
          parseNumber(
            parsed.confidence?.click_retry_max,
            DEFAULT_CONFIG.confidence.clickRetryMax,
          ),
        ),
      },
      calibration: {
        window: Math.round(
          parseNumber(
            parsed.calibration?.window,
            DEFAULT_CONFIG.calibration.window,
          ),
        ),
        delayMs: Math.round(
          parseNumber(
            parsed.calibration?.delay_ms,
            DEFAULT_CONFIG.calibration.delayMs,
          ),
        ),
        enablePostClick: parseBoolean(
          parsed.calibration?.enable_post_click,
          DEFAULT_CONFIG.calibration.enablePostClick,
        ),
      },
    } satisfies UniversalCoordinatesConfig;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      `Failed to load universal coordinate config: ${(error as Error).message}`,
    );
    return DEFAULT_CONFIG;
  }
}

export function loadUniversalCoordinatesConfig(): UniversalCoordinatesConfig {
  if (!cachedConfig) {
    cachedConfig = loadFromDisk();
  }
  return cachedConfig;
}

export const UNIVERSAL_COORDINATES_CONFIG = loadUniversalCoordinatesConfig();

