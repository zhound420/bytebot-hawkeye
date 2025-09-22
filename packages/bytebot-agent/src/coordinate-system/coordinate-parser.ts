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

export interface CoordinateSuspicionOptions {
  dimensions?: { width: number; height: number } | null;
}

export interface CoordinateSuspicionResult {
  suspicious: boolean;
  reasons: string[];
}

interface CoordinateCandidate {
  x: number;
  y: number;
  score: number;
  index: number;
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

function coerceNumber(input: unknown): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    const match = trimmed.match(/-?\d+(?:\.\d+)?/);
    if (!match) {
      return null;
    }
    const parsed = Number.parseFloat(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

  const coerceFromKeys = (keys: Array<string | number>): number | null => {
    for (const key of keys) {
      const candidate = coerceNumber(value[key as keyof typeof value]);
      if (candidate != null) {
        return candidate;
      }
    }
    return null;
  };

  const x = coerceFromKeys(['x', 'X', 'globalX', 'global_x', 0, '0']);
  const y = coerceFromKeys(['y', 'Y', 'globalY', 'global_y', 1, '1']);

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

  const coerceFromKeys = (keys: Array<string | number>): number | null => {
    for (const key of keys) {
      const candidate = coerceNumber(value[key as keyof typeof value]);
      if (candidate != null) {
        return candidate;
      }
    }
    return null;
  };

  const x = coerceFromKeys(['x', 'X', 'left', 'Left']);
  const y = coerceFromKeys(['y', 'Y', 'top', 'Top']);
  const width = coerceFromKeys(['width', 'Width', 'w', 'W']);
  const height = coerceFromKeys(['height', 'Height', 'h', 'H']);

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

function extractCoordinatesFromText(input: string): Coordinates | null {
  const candidates: CoordinateCandidate[] = [];
  const lowered = input.toLowerCase();
  const positiveContextPattern =
    /\b(click|tap|double[-\s]?click|coordinate|coordinates|coord|coords|point|points|position|pos|location|target|center|centre|pixel|spot|area|cursor|pointer|press|focus|aim)\b/i;
  const bannedContextPattern =
    /\b(confidence|score|probability|accuracy|precision|recall|likelihood|certainty|metric|rate)\b/i;

  const addCandidate = (
    rawX: number,
    rawY: number,
    index: number,
    matchLength: number,
    baseScore: number,
  ) => {
    if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) {
      return;
    }

    const preceding = lowered.slice(Math.max(0, index - 30), index);
    const following = lowered.slice(index, Math.min(input.length, index + matchLength + 30));

    const hasPositiveBefore = positiveContextPattern.test(preceding);
    const hasPositiveAfter = positiveContextPattern.test(following);
    const hasPositiveCue = hasPositiveBefore || hasPositiveAfter;
    const hasBannedBefore = bannedContextPattern.test(preceding);

    const smallFractionX = Math.abs(rawX) <= 5 && !Number.isInteger(rawX);
    const bothTinyDecimals =
      Math.abs(rawX) <= 1 &&
      Math.abs(rawY) <= 1 &&
      (!Number.isInteger(rawX) || !Number.isInteger(rawY));

    if (bothTinyDecimals) {
      return;
    }

    if (hasBannedBefore && !hasPositiveBefore && smallFractionX) {
      return;
    }

    let score = baseScore;
    if (hasPositiveCue) {
      score += 3;
    }
    if (hasBannedBefore) {
      score -= 2;
    }
    if (Number.isInteger(rawX) && Number.isInteger(rawY)) {
      score += 1;
    }
    if (!Number.isInteger(rawX) && Math.abs(rawX) < 5) {
      score -= 1;
    }
    if (!Number.isInteger(rawY) && Math.abs(rawY) < 5) {
      score -= 1;
    }

    const magnitudeScore = Math.min(Math.abs(rawX) + Math.abs(rawY), 2000) / 500;
    score += magnitudeScore;

    candidates.push({
      x: Math.round(rawX),
      y: Math.round(rawY),
      index,
      score,
    });
  };

  for (const match of input.matchAll(/\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/g)) {
    const index = match.index ?? input.indexOf(match[0]);
    addCandidate(
      Number.parseFloat(match[1]),
      Number.parseFloat(match[2]),
      index,
      match[0].length,
      6,
    );
  }

  const xyPattern =
    /\bx\s*[:=]\s*(-?\d+(?:\.\d+)?)\b[^0-9-]{0,20}\by\s*[:=]\s*(-?\d+(?:\.\d+)?)\b/gi;
  for (const match of input.matchAll(xyPattern)) {
    const index = match.index ?? input.indexOf(match[0]);
    addCandidate(
      Number.parseFloat(match[1]),
      Number.parseFloat(match[2]),
      index,
      match[0].length,
      7,
    );
  }

  const yxPattern =
    /\by\s*[:=]\s*(-?\d+(?:\.\d+)?)\b[^0-9-]{0,20}\bx\s*[:=]\s*(-?\d+(?:\.\d+)?)\b/gi;
  for (const match of input.matchAll(yxPattern)) {
    const index = match.index ?? input.indexOf(match[0]);
    addCandidate(
      Number.parseFloat(match[2]),
      Number.parseFloat(match[1]),
      index,
      match[0].length,
      7,
    );
  }

  const labeledPattern =
    /\b(?:coordinate|coordinates|coords?|point|points|position|pos|location|target|click|tap|press|center|centre|pixel|spot)\b[^0-9-]*(-?\d+(?:\.\d+)?)[^0-9-]+(-?\d+(?:\.\d+)?)/gi;
  for (const match of input.matchAll(labeledPattern)) {
    const index = match.index ?? input.indexOf(match[0]);
    addCandidate(
      Number.parseFloat(match[1]),
      Number.parseFloat(match[2]),
      index,
      match[0].length,
      5,
    );
  }

  if (!candidates.length) {
    for (const match of input.matchAll(/(-?\d+(?:\.\d+)?)[^0-9-]+(-?\d+(?:\.\d+)?)/g)) {
      const index = match.index ?? input.indexOf(match[0]);
      addCandidate(
        Number.parseFloat(match[1]),
        Number.parseFloat(match[2]),
        index,
        match[0].length,
        1,
      );
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.index - b.index;
  });

  const best = candidates[0];
  return { x: best.x, y: best.y };
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
      result.global = extractCoordinatesFromText(sanitized);
    }

    const normalized = sanitized.toLowerCase();
    const negativeZoomPatterns = [
      /\bno\s+zoom\b/,
      /\bzoom\s*(?:=|:)\s*(?:false|0|no)\b/,
      /\bzoom\s+(?:not\s+needed|not\s+necessary|not\s+required)\b/,
      /\bwithout\s+zoom\b/,
    ];
    const hasNegativeZoomCue = negativeZoomPatterns.some((pattern) =>
      pattern.test(normalized),
    );

    if (hasNegativeZoomCue) {
      result.needsZoom = false;
    } else if (/(zoom|refine|closer)/i.test(sanitized)) {
      result.needsZoom = true;
    }

    return result;
  }
}

const isMultipleOf = (value: number, divisor: number): boolean => {
  if (!divisor) {
    return false;
  }
  return value % divisor === 0;
};

export function evaluateCoordinateSuspicion(
  parsed: ParsedCoordinateResponse,
  options: CoordinateSuspicionOptions = {},
): CoordinateSuspicionResult {
  const reasons: string[] = [];
  const global = parsed.global;

  if (!global) {
    return { suspicious: false, reasons };
  }

  const dimensions = options.dimensions ?? null;
  if (dimensions) {
    const outOfBounds =
      global.x < 0 ||
      global.y < 0 ||
      global.x >= dimensions.width ||
      global.y >= dimensions.height;
    if (outOfBounds) {
      reasons.push(
        `Coordinates (${global.x}, ${global.y}) fall outside the known bounds (${dimensions.width}×${dimensions.height}).`,
      );
    }
  }

  if (isMultipleOf(global.x, 100) && isMultipleOf(global.y, 100)) {
    reasons.push('Coordinates align exactly with the 100 px grid intersections.');
  } else if (isMultipleOf(global.x, 50) && isMultipleOf(global.y, 50)) {
    reasons.push('Coordinates are rounded to 50 px increments.');
  } else if (isMultipleOf(global.x, 25) && isMultipleOf(global.y, 25)) {
    reasons.push('Coordinates are rounded to 25 px increments.');
  }

  return {
    suspicious: reasons.length > 0,
    reasons,
  };
}
