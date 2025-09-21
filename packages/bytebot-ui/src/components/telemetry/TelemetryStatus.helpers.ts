import { formatDistanceStrict } from "date-fns";

import { TelemetrySummary } from "@/types";

export type NormalizedTelemetrySession = {
  id: string;
  label: string;
  startedAt: string | null;
  endedAt: string | null;
  lastEventAt: string | null;
  eventCount?: number;
};

export type NormalizedTelemetryEvent = {
  type: string;
  timestamp: string | null;
  metadata: Record<string, unknown>;
};

export function normalizeTelemetrySession(
  raw: unknown,
): NormalizedTelemetrySession | null {
  if (!raw) {
    return null;
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }
    return {
      id: trimmed,
      label: trimmed,
      startedAt: null,
      endedAt: null,
      lastEventAt: null,
    };
  }

  if (typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const idSource = candidate.id ?? candidate.sessionId;
  const id =
    typeof idSource === "string" && idSource.trim().length > 0
      ? idSource.trim()
      : null;
  if (!id) {
    return null;
  }

  const label =
    typeof candidate.label === "string" && candidate.label.trim().length > 0
      ? candidate.label
      : id;
  const startedAt =
    typeof candidate.startedAt === "string" && candidate.startedAt.length > 0
      ? candidate.startedAt
      : null;
  const endedAt =
    typeof candidate.endedAt === "string" && candidate.endedAt.length > 0
      ? candidate.endedAt
      : null;
  const lastEventAt =
    typeof candidate.lastEventAt === "string" &&
    candidate.lastEventAt.length > 0
      ? candidate.lastEventAt
      : null;
  const eventCount =
    typeof candidate.eventCount === "number" &&
    Number.isFinite(candidate.eventCount)
      ? candidate.eventCount
      : undefined;

  return {
    id,
    label,
    startedAt,
    endedAt,
    lastEventAt,
    eventCount,
  };
}

export function normalizeTelemetryEvents(
  raw: unknown,
): NormalizedTelemetryEvent[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const candidate = entry as Record<string, unknown>;
      const type =
        typeof candidate.type === "string" && candidate.type.length > 0
          ? candidate.type
          : "event";
      const timestamp =
        typeof candidate.timestamp === "string" &&
        candidate.timestamp.length > 0
          ? candidate.timestamp
          : null;
      const metadata = { ...candidate };
      delete metadata.type;
      delete metadata.timestamp;

      return { type, timestamp, metadata };
    })
    .filter((entry): entry is NormalizedTelemetryEvent => entry !== null);
}

export function coalesceSessionTimestamps(
  summaryStart: string | null | undefined,
  summaryEnd: string | null | undefined,
  session: NormalizedTelemetrySession | null,
): { start: string | null; end: string | null } {
  const startCandidate =
    typeof summaryStart === "string" && summaryStart.length > 0
      ? summaryStart
      : session?.startedAt ?? null;
  const endCandidate =
    typeof summaryEnd === "string" && summaryEnd.length > 0
      ? summaryEnd
      : session?.endedAt ?? session?.lastEventAt ?? null;

  return { start: startCandidate, end: endCandidate };
}

export function formatSessionDurationFromTiming(
  summary: Pick<
    TelemetrySummary,
    "sessionDurationMs" | "sessionStart" | "sessionEnd"
  > | null,
  session: NormalizedTelemetrySession | null,
  now: Date = new Date(),
): string | null {
  const explicitDuration =
    summary &&
    typeof summary.sessionDurationMs === "number" &&
    Number.isFinite(summary.sessionDurationMs) &&
    summary.sessionDurationMs > 0
      ? summary.sessionDurationMs
      : null;
  if (explicitDuration) {
    return formatDistanceStrict(0, explicitDuration, { unit: "second" });
  }

  const { start, end } = coalesceSessionTimestamps(
    summary?.sessionStart ?? null,
    summary?.sessionEnd ?? null,
    session,
  );
  const startDate = parseIsoDate(start);
  const endDate = parseIsoDate(end) ?? (startDate ? now : null);
  if (startDate && endDate) {
    return formatDistanceStrict(startDate, endDate, { unit: "second" });
  }
  return null;
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
