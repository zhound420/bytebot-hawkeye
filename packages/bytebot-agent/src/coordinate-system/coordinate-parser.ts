import { Coordinates } from '../agent/smart-click.types';

export interface ZoomDirective {
  center?: Coordinates | null;
  radius?: number | null;
  region?: { x: number; y: number; width: number; height: number } | null;
}

export interface ParsedCoordinateResponse {
  raw: string;
  global?: Coordinates | null;
  local?: Coordinates | null;
  confidence?: number | null;
  needsZoom?: boolean;
  zoom?: ZoomDirective | null;
  reasoning?: string | null;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', 'zoom', 'refine'].includes(normalized)) {
      return true;
    }
    if (['false', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }
  return undefined;
}

function sanitizeJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

function normalizeCoords(value: any): Coordinates | null {
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      const match = value.match(/(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/);
      if (match) {
        return {
          x: Math.round(Number.parseFloat(match[1])),
          y: Math.round(Number.parseFloat(match[2])),
        };
      }
    }
    return null;
  }

  const x =
    typeof value.x === 'number'
      ? value.x
      : typeof value.X === 'number'
        ? value.X
        : typeof value.globalX === 'number'
          ? value.globalX
          : typeof value.global_x === 'number'
            ? value.global_x
            : typeof value[0] === 'number'
              ? value[0]
              : null;
  const y =
    typeof value.y === 'number'
      ? value.y
      : typeof value.Y === 'number'
        ? value.Y
        : typeof value.globalY === 'number'
          ? value.globalY
          : typeof value.global_y === 'number'
            ? value.global_y
            : typeof value[1] === 'number'
              ? value[1]
              : null;

  if (x == null || y == null) {
    return null;
  }

  return { x: Math.round(x), y: Math.round(y) };
}

function normalizeRegion(
  value: any,
): { x: number; y: number; width: number; height: number } | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const x =
    typeof value.x === 'number'
      ? value.x
      : typeof value.left === 'number'
        ? value.left
        : null;
  const y =
    typeof value.y === 'number'
      ? value.y
      : typeof value.top === 'number'
        ? value.top
        : null;
  const width =
    typeof value.width === 'number'
      ? value.width
      : typeof value.w === 'number'
        ? value.w
        : null;
  const height =
    typeof value.height === 'number'
      ? value.height
      : typeof value.h === 'number'
        ? value.h
        : null;

  if (x == null || y == null || width == null || height == null) {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function extractConfidence(json: any): number | null {
  const candidates = [
    json.confidence,
    json.confidence_score,
    json.confidenceScore,
    json.score,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      const clamped = Math.max(0, Math.min(1, candidate));
      return Number.parseFloat(clamped.toFixed(3));
    }
    if (typeof candidate === 'string') {
      const parsed = Number.parseFloat(candidate);
      if (Number.isFinite(parsed)) {
        const clamped = Math.max(0, Math.min(1, parsed));
        return Number.parseFloat(clamped.toFixed(3));
      }
    }
  }
  return null;
}

export class CoordinateParser {
  parse(raw: string): ParsedCoordinateResponse {
    const sanitized = sanitizeJson(raw);
    const result: ParsedCoordinateResponse = {
      raw,
      global: null,
      local: null,
      confidence: null,
      needsZoom: undefined,
      zoom: null,
      reasoning: null,
    };

    if (!sanitized) {
      return result;
    }

    try {
      const json = JSON.parse(sanitized);
      result.global = normalizeCoords(
        json.global ?? json.globalCoordinates ?? json,
      );
      result.local = normalizeCoords(json.local ?? json.localCoordinates);
      result.confidence = extractConfidence(json);

      const needsZoom = parseBoolean(
        json.needsZoom ?? json.zoomNeeded ?? json.requiresZoom ?? json.zoom,
      );
      if (needsZoom !== undefined) {
        result.needsZoom = needsZoom;
      }

      const zoomPayload =
        json.zoom ?? json.zoomDirective ?? json.zoomRecommendation ?? null;
      if (zoomPayload) {
        const zoom: ZoomDirective = {
          center: normalizeCoords(
            zoomPayload.center ?? zoomPayload.origin ?? zoomPayload.point,
          ),
          radius:
            typeof zoomPayload.radius === 'number'
              ? Math.max(0, Math.round(zoomPayload.radius))
              : typeof zoomPayload.size === 'number'
                ? Math.max(0, Math.round(zoomPayload.size))
                : null,
          region: normalizeRegion(
            zoomPayload.region ?? zoomPayload.bounds ?? zoomPayload.box,
          ),
        };
        result.zoom = zoom;
      }

      const reasoning =
        json.reasoning ?? json.reason ?? json.notes ?? json.explanation;
      if (typeof reasoning === 'string') {
        result.reasoning = reasoning.trim();
      }

      return result;
    } catch {
      // fall through
    }

    const globalMatch = sanitized.match(
      /global[^\d-]*(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/i,
    );
    if (globalMatch) {
      result.global = {
        x: Math.round(Number.parseFloat(globalMatch[1])),
        y: Math.round(Number.parseFloat(globalMatch[2])),
      };
    }

    if (!result.global) {
      const pair = sanitized.match(/(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/);
      if (pair) {
        result.global = {
          x: Math.round(Number.parseFloat(pair[1])),
          y: Math.round(Number.parseFloat(pair[2])),
        };
      }
    }

    const needsZoom = sanitized.match(/zoom|refine|closer/i);
    if (needsZoom) {
      result.needsZoom = true;
    }

    return result;
  }
}
