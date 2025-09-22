import assert from "node:assert/strict";
import { test } from "node:test";

import {
  coalesceSessionTimestamps,
  formatSessionDurationFromTiming,
  normalizeTelemetryEvents,
  normalizeTelemetrySession,
  type NormalizedTelemetrySession,
} from "../TelemetryStatus.helpers";

test("normalizeTelemetrySession normalizes string identifiers", () => {
  const session = normalizeTelemetrySession("session-123");
  assert.ok(session);
  assert.equal(session.id, "session-123");
  assert.equal(session.label, "session-123");
  assert.equal(session.startedAt, null);
  assert.equal(session.sessionStart, null);
  assert.equal(session.sessionDurationMs, null);
});

test("normalizeTelemetrySession extracts structured metadata", () => {
  const session = normalizeTelemetrySession({
    id: "alpha",
    label: "Alpha Session",
    startedAt: "2024-04-01T10:00:00.000Z",
    endedAt: "2024-04-01T10:05:00.000Z",
    lastEventAt: "2024-04-01T10:05:30.000Z",
    eventCount: 42,
    sessionDurationMs: 300000,
  });

  assert.ok(session);
  assert.equal(session?.label, "Alpha Session");
  assert.equal(session?.lastEventAt, "2024-04-01T10:05:30.000Z");
  assert.equal(session?.eventCount, 42);
  assert.equal(session?.sessionDurationMs, 300000);
});

test("normalizeTelemetrySession picks up daemon session summaries", () => {
  const session = normalizeTelemetrySession({
    id: "daemon-1",
    sessionStart: "2024-07-01T00:00:00.000Z",
    sessionEnd: "2024-07-01T00:10:00.000Z",
    sessionDurationMs: 600000,
  });

  assert.ok(session);
  assert.equal(session?.startedAt, "2024-07-01T00:00:00.000Z");
  assert.equal(session?.endedAt, "2024-07-01T00:10:00.000Z");
  assert.equal(session?.sessionStart, "2024-07-01T00:00:00.000Z");
  assert.equal(session?.sessionDurationMs, 600000);
});

test("coalesceSessionTimestamps falls back to session metadata", () => {
  const session: NormalizedTelemetrySession = {
    id: "beta",
    label: "beta",
    startedAt: "2024-05-05T12:00:00.000Z",
    endedAt: null,
    lastEventAt: "2024-05-05T12:03:30.000Z",
    sessionStart: "2024-05-05T12:00:00.000Z",
    sessionEnd: null,
    sessionDurationMs: null,
  };

  const { start, end } = coalesceSessionTimestamps(null, null, session);
  assert.equal(start, "2024-05-05T12:00:00.000Z");
  assert.equal(end, "2024-05-05T12:03:30.000Z");
});

test("formatSessionDurationFromTiming prefers explicit duration", () => {
  const label = formatSessionDurationFromTiming(
    { sessionDurationMs: 90_000, sessionStart: null, sessionEnd: null },
    null,
    new Date(0),
  );

  assert.equal(label, "2 minutes");
});

test("formatSessionDurationFromTiming falls back to session duration", () => {
  const session: NormalizedTelemetrySession = {
    id: "daemon-1",
    label: "daemon-1",
    startedAt: null,
    endedAt: null,
    lastEventAt: null,
    sessionStart: null,
    sessionEnd: null,
    sessionDurationMs: 45_000,
  };

  const label = formatSessionDurationFromTiming(null, session, new Date(0));
  assert.equal(label, "1 minute");
});

test("normalizeTelemetryEvents extracts metadata and timestamps", () => {
  const events = normalizeTelemetryEvents([
    {
      type: "hover_probe",
      timestamp: "2024-06-01T09:30:00.000Z",
      diff: 12.5,
      app: "firefox",
    },
    { type: "custom" },
  ]);

  assert.equal(events.length, 2);
  assert.equal(events[0].type, "hover_probe");
  assert.equal(events[0].timestamp, "2024-06-01T09:30:00.000Z");
  assert.deepEqual(events[0].metadata, {
    diff: 12.5,
    app: "firefox",
  });
  assert.equal(events[1].type, "custom");
  assert.equal(events[1].timestamp, null);
});
