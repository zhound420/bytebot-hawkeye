"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TelemetrySummary, TelemetrySessions } from "@/types";
import {
  NormalizedTelemetryEvent,
  NormalizedTelemetrySession,
  coalesceSessionTimestamps,
  formatSessionDurationFromTiming,
  normalizeTelemetryEvents,
  normalizeTelemetrySession,
  parseIsoDate,
} from "./TelemetryStatus.helpers";

const defaultNumberFormat: Intl.NumberFormatOptions = {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
};

function formatNumber(
  value: number | null | undefined,
  options: Intl.NumberFormatOptions = defaultNumberFormat,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", options).format(value);
}

type Props = {
  className?: string;
};

export function TelemetryStatus({ className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TelemetrySummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState<
    NormalizedTelemetrySession[]
  >([]);
  const [reportedSessionId, setReportedSessionId] = useState<string | null>(
    null,
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );
  const activeSessionId = useMemo(() => {
    if (selectedSessionId) {
      return selectedSessionId;
    }
    if (reportedSessionId) {
      return reportedSessionId;
    }
    return sessions[0]?.id ?? "";
  }, [reportedSessionId, selectedSessionId, sessions]);
  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ?? null,
    [sessions, activeSessionId],
  );

  const selectedSessionValue = useMemo(() => {
    if (!sessions.length) {
      return "";
    }
    if (
      activeSessionId &&
      sessions.some((session) => session.id === activeSessionId)
    ) {
      return activeSessionId;
    }
    return sessions[0]?.id ?? "";
  }, [activeSessionId, sessions]);

  const singleSessionLabel = useMemo(() => {
    if (!sessions.length) {
      return "Awaiting data";
    }
    return (
      activeSession?.label ??
      sessions.find((session) => session.id === selectedSessionValue)?.label ??
      sessions[0]?.label ??
      "Current session"
    );
  }, [activeSession, selectedSessionValue, sessions]);

  const refresh = useCallback(async () => {
    setBusy(true);
    const params = new URLSearchParams();
    const session = activeSessionId;
    if (session) {
      params.set("session", session);
    }
    const query = params.toString();
    try {
      const res = await fetch(
        `/api/tasks/telemetry/summary${query ? `?${query}` : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = (await res.json()) as TelemetrySummary;
      setData(json);
    } catch (error) {
      void error;
      // Preserve the previous snapshot when the summary request fails
    } finally {
      setBusy(false);
    }
  }, [activeSessionId]);

  const reset = useCallback(async () => {
    setBusy(true);
    const params = new URLSearchParams();
    const session = activeSessionId;
    if (session) {
      params.set("session", session);
    }
    const query = params.toString();
    try {
      const res = await fetch(`/api/tasks/telemetry/reset${query ? `?${query}` : ""}`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to reset telemetry");
      }
      await refreshSessions();
      await refresh();
    } catch {
      setBusy(false);
    }
  }, [activeSessionId, refresh, refreshSessions]);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks/telemetry/sessions", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const payload = (await res.json()) as TelemetrySessions;
      const rawSessions = Array.isArray(payload?.sessions)
        ? (payload.sessions as unknown[])
        : [];
      const normalizedSessions = rawSessions
        .map((session) => normalizeTelemetrySession(session))
        .filter(
          (session): session is NormalizedTelemetrySession => session !== null,
        );
      const reportedCurrent = normalizeTelemetrySession(payload?.current);

      const deduped: NormalizedTelemetrySession[] = [];
      const seen = new Set<string>();
      const ordered = reportedCurrent
        ? [reportedCurrent, ...normalizedSessions]
        : normalizedSessions;
      for (const session of ordered) {
        if (!seen.has(session.id)) {
          deduped.push(session);
          seen.add(session.id);
        }
      }

      setSessions(deduped);
      setReportedSessionId(reportedCurrent?.id ?? null);
      setSelectedSessionId((prev) => {
        if (!prev) {
          return prev;
        }
        return deduped.some((session) => session.id === prev) ? prev : null;
      });
    } catch (error) {
      void error;
      // Ignore session discovery failures and keep the existing list
    }
  }, []);

  useEffect(() => {
    refreshSessions();
    const t = setInterval(refreshSessions, 30000);
    return () => clearInterval(t);
  }, [refreshSessions]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [refresh]);

  const normalizedEvents = useMemo<NormalizedTelemetryEvent[]>(
    () => normalizeTelemetryEvents(data?.events),
    [data],
  );

  const { start: sessionStartIso, end: sessionEndIso } = useMemo(
    () =>
      coalesceSessionTimestamps(
        data?.sessionStart ?? null,
        data?.sessionEnd ?? null,
        activeSession,
      ),
    [activeSession, data?.sessionEnd, data?.sessionStart],
  );

  const sessionStartLabel = useMemo(() => {
    const date = parseIsoDate(sessionStartIso);
    return date ? format(date, "MMM d, yyyy HH:mm:ss") : null;
  }, [sessionStartIso]);

  const sessionEndLabel = useMemo(() => {
    const date = parseIsoDate(sessionEndIso);
    return date ? format(date, "MMM d, yyyy HH:mm:ss") : null;
  }, [sessionEndIso]);

  const sessionDurationLabel = useMemo(
    () =>
      formatSessionDurationFromTiming(
        data
          ? {
              sessionDurationMs: data.sessionDurationMs ?? null,
              sessionStart: data.sessionStart ?? null,
              sessionEnd: data.sessionEnd ?? null,
            }
          : null,
        activeSession,
      ),
    [activeSession, data],
  );

  const sparkBars = useMemo(() => {
    const vals = data?.recentAbsDeltas || [];
    if (!vals.length) return null;
    const max = Math.max(...vals);
    return vals.map((v, i) => {
      const h = max > 0 ? Math.max(1, Math.round((v / max) * 16)) : 1;
      return (
        <div
          key={i}
          className="w-[3px] rounded bg-bytebot-bronze-light-9 opacity-50 dark:bg-bytebot-bronze-dark-9"
          style={{ height: `${h}px` }}
          title={`${formatNumber(v, { maximumFractionDigits: 1 })} px`}
        />
      );
    });
  }, [data]);

  return (
    <div className={className}>
      {/* Status strip */}
      <div className="flex items-center justify-between rounded-md border border-border bg-card px-2 py-1 text-card-foreground shadow-sm dark:bg-muted">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground dark:text-card-foreground">
          <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
            live
          </span>
          <span>
            Targeted: <span className="font-semibold">{data?.targetedClicks ?? 0}</span>
          </span>
          <span>
            Avg Δ: <span className="font-semibold">{formatNumber(data?.avgAbsDelta)}</span>
          </span>
          <span>
            Smart (completed): <span className="font-semibold">{data?.smartClicks ?? 0}</span>
          </span>
          <span>
            Zooms: <span className="font-semibold">{data?.progressiveZooms ?? 0}</span>
          </span>
          <div className="ml-1 flex h-4 items-end gap-[2px]">{sparkBars}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border border-border px-2 py-0.5 text-[11px] text-card-foreground transition-colors hover:bg-muted/70 dark:hover:bg-muted/40"
            onClick={refresh}
            disabled={busy}
          >
            Refresh
          </button>
          <button
            className="rounded border border-border px-2 py-0.5 text-[11px] text-card-foreground transition-colors hover:bg-muted/70 dark:hover:bg-muted/40"
            onClick={() => setOpen(true)}
          >
            Details
          </button>
        </div>
      </div>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/30 dark:bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="h-full w-[360px] overflow-y-auto border border-border bg-card p-3 text-card-foreground shadow-xl dark:bg-muted">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-card-foreground">Desktop Accuracy</h3>
              <div className="flex items-center gap-2">
                <button
                  className="rounded border border-border px-2 py-0.5 text-[11px] text-card-foreground transition-colors hover:bg-muted/70 dark:hover:bg-muted/40"
                  onClick={refresh}
                  disabled={busy}
                >
                  Refresh
                </button>
                <button
                  className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-400/40 dark:bg-red-500/20 dark:text-red-200 dark:hover:bg-red-500/30"
                  onClick={reset}
                  disabled={busy}
                >
                  Reset
                </button>
                <button
                  className="rounded border border-border px-2 py-0.5 text-[11px] text-card-foreground transition-colors hover:bg-muted/70 dark:hover:bg-muted/40"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-2 text-[11px] text-card-foreground dark:bg-muted/40">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Session overview
                </div>
                <div className="flex min-w-[180px] justify-end">
                  {sessions.length > 1 ? (
                    <Select
                      value={selectedSessionValue}
                      onValueChange={(value) => setSelectedSessionId(value)}
                      disabled={!sessions.length}
                    >
                      <SelectTrigger className="h-8 w-full justify-between rounded-md border border-border/60 bg-card/60 px-2 text-[11px] font-medium text-card-foreground shadow-sm transition-colors hover:bg-card/80 focus:ring-2 focus:ring-bytebot-bronze-light-a3 focus:ring-offset-0 dark:bg-muted/60 dark:hover:bg-muted/70">
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        {sessions.map((session) => (
                          <SelectItem key={session.id} value={session.id}>
                            {session.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-card/60 px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground shadow-sm dark:bg-muted/60">
                      <span>{sessions.length ? "Active session" : "Sessions"}</span>
                      <span className="rounded bg-bytebot-bronze-light-a3 px-2 py-0.5 text-[11px] font-semibold text-bytebot-bronze-light-12 dark:bg-bytebot-bronze-dark-a3 dark:text-bytebot-bronze-dark-12">
                        {singleSessionLabel}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2">
                <div className="rounded border border-border/70 bg-card/40 px-2 py-1 dark:bg-muted/40">
                  <div className="text-[10px] text-muted-foreground">Start</div>
                  <div className="text-[11px] font-medium text-card-foreground">
                    {sessionStartLabel ?? "Pending"}
                  </div>
                </div>
                <div className="rounded border border-border/70 bg-card/40 px-2 py-1 dark:bg-muted/40">
                  <div className="text-[10px] text-muted-foreground">End</div>
                  <div className="text-[11px] font-medium text-card-foreground">
                    {sessionEndLabel ??
                      (sessionStartLabel ? "In progress" : "Pending")}
                  </div>
                </div>
                <div className="rounded border border-border/70 bg-card/40 px-2 py-1 dark:bg-muted/40">
                  <div className="text-[10px] text-muted-foreground">Duration</div>
                  <div className="text-[11px] font-medium text-card-foreground">
                    {sessionDurationLabel ?? "Not yet available"}
                  </div>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="rounded border border-border/70 bg-card/40 px-2 py-1 text-[11px] text-card-foreground dark:bg-muted/40">
                  Events: <span className="font-semibold">{activeSession?.eventCount ?? normalizedEvents.length}</span>
                </div>
                <div className="rounded border border-border/70 bg-card/40 px-2 py-1 text-[11px] text-card-foreground dark:bg-muted/40">
                  Session ID: <span className="break-all font-mono text-[10px] text-muted-foreground">{activeSession?.id ?? "(current)"}</span>
                </div>
              </div>
            </div>

            {/* Primary metrics */}
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <div className="rounded-md border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-1 p-2 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2">
                <div className="text-[10px] text-bytebot-bronze-light-10 dark:text-bytebot-bronze-dark-10">Targeted</div>
                <div className="text-[14px] font-semibold text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{data?.targetedClicks ?? 0}</div>
              </div>
              <div className="rounded-md border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-1 p-2 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2">
                <div className="text-[10px] text-bytebot-bronze-light-10 dark:text-bytebot-bronze-dark-10">Untargeted</div>
                <div className="text-[14px] font-semibold text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{data?.untargetedClicks ?? 0}</div>
              </div>
              <div className="rounded-md border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-1 p-2 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2">
                <div className="text-[10px] text-bytebot-bronze-light-10 dark:text-bytebot-bronze-dark-10">Avg Δ (px)</div>
                <div className="text-[14px] font-semibold text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{formatNumber(data?.avgAbsDelta)}</div>
              </div>
            </div>

            {/* Chips row 1 */}
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-card-foreground">
              <div className="rounded border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-2 px-2 py-1 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2 dark:text-bytebot-bronze-dark-12">
                Keys: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{data?.actionCounts?.["type_keys"] ?? 0}</span>
              </div>
              <div className="rounded border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-2 px-2 py-1 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2 dark:text-bytebot-bronze-dark-12">
                Scrolls: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{data?.actionCounts?.["scroll"] ?? 0}</span>
              </div>
              <div className="rounded border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-2 px-2 py-1 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2 dark:text-bytebot-bronze-dark-12">
                Screens: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{data?.actionCounts?.["screenshot"] ?? 0}</span>
              </div>
            </div>

            {/* Chips row 2 */}
            <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-card-foreground">
              <div
                className="rounded border border-bytebot-bronze-light-7 bg-bytebot-bronze-light-a3 px-2 py-1 text-bytebot-bronze-light-12 dark:border-bytebot-bronze-dark-7 dark:bg-bytebot-bronze-dark-a3 dark:text-bytebot-bronze-dark-12"
                title="Count of successful smart clicks"
              >
                Smart (completed): <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{data?.smartClicks ?? 0}</span>
              </div>
              <div className="rounded border border-bytebot-bronze-light-7 bg-bytebot-bronze-light-a3 px-2 py-1 text-bytebot-bronze-light-12 dark:border-bytebot-bronze-dark-7 dark:bg-bytebot-bronze-dark-a3 dark:text-bytebot-bronze-dark-12">
                Zooms: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{data?.progressiveZooms ?? 0}</span>
              </div>
              <div className="rounded border border-bytebot-bronze-light-7 bg-bytebot-bronze-light-a3 px-2 py-1 text-bytebot-bronze-light-12 dark:border-bytebot-bronze-dark-7 dark:bg-bytebot-bronze-dark-a3 dark:text-bytebot-bronze-dark-12">
                Retries: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{data?.retryClicks ?? 0}</span>
              </div>
            </div>

            {/* Deltas */}
            <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-card-foreground">
              <div className="rounded border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-2 px-2 py-1 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2 dark:text-bytebot-bronze-dark-12">
                Hover Δ avg: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{formatNumber(data?.hoverProbes?.avgDiff, { maximumFractionDigits: 2 })}</span> ({data?.hoverProbes?.count ?? 0})
              </div>
              <div className="rounded border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-2 px-2 py-1 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2 dark:text-bytebot-bronze-dark-12">
                Post Δ avg: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{formatNumber(data?.postClickDiff?.avgDiff, { maximumFractionDigits: 2 })}</span> ({data?.postClickDiff?.count ?? 0})
              </div>
            </div>

            {/* Large sparkline */}
            {Array.isArray(data?.recentAbsDeltas) && data!.recentAbsDeltas!.length > 0 && (
              <div className="mt-2 flex h-8 items-end gap-[3px]">
                {data!.recentAbsDeltas!.map((v, i) => {
                  const max = Math.max(...(data!.recentAbsDeltas as number[]));
                  const h = max > 0 ? Math.max(2, Math.round((v / max) * 28)) : 2;
                  return (
                    <div
                      key={i}
                      style={{ height: `${h}px` }}
                      className="w-[5px] rounded bg-bytebot-bronze-light-9 opacity-60 dark:bg-bytebot-bronze-dark-9"
                      title={`${formatNumber(v, { maximumFractionDigits: 1 })} px`}
                    />
                  );
                })}
              </div>
            )}

            {/* Footer cards */}
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-card-foreground">
              <div className="rounded border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-2 px-2 py-1 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2 dark:text-bytebot-bronze-dark-12">
                Δx: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{formatNumber(data?.avgDeltaX, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="rounded border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-2 px-2 py-1 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2 dark:text-bytebot-bronze-dark-12">
                Δy: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{formatNumber(data?.avgDeltaY, { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="rounded border border-bytebot-bronze-light-6 bg-bytebot-bronze-light-2 px-2 py-1 dark:border-bytebot-bronze-dark-6 dark:bg-bytebot-bronze-dark-2 dark:text-bytebot-bronze-dark-12">
                Calib: <span className="font-medium text-bytebot-bronze-light-12 dark:text-bytebot-bronze-dark-12">{data?.calibrationSnapshots ?? 0}</span>
              </div>
            </div>

            <div className="mt-3">
              <div className="text-[11px] font-semibold text-card-foreground">Recent events</div>
              <div className="mt-1 overflow-hidden rounded-md border border-border bg-card/80 shadow-inner dark:bg-muted/40">
                <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-card/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-muted/50">
                  <span>Recent actions</span>
                  <span className="font-mono text-[10px] font-normal text-muted-foreground">
                    {normalizedEvents.length}
                  </span>
                </div>
                <ScrollArea className="max-h-56 pr-1">
                  <div className="space-y-2 px-3 py-2">
                    {normalizedEvents.length === 0 ? (
                      <div className="rounded-md border border-dashed border-border/70 bg-card/60 px-3 py-3 text-center text-[11px] text-muted-foreground">
                        No events recorded yet for this session.
                      </div>
                    ) : (
                      normalizedEvents.map((event, idx) => {
                        const timestamp = event.timestamp
                          ? parseIsoDate(event.timestamp)
                          : null;
                        const formattedTimestamp = timestamp
                          ? format(timestamp, "MMM d, yyyy HH:mm:ss")
                          : "—";
                        const metadataEntries = Object.entries(event.metadata).filter(
                          ([, value]) => value !== undefined && value !== null,
                        );
                        const metadataDisplay = metadataEntries.length
                          ? JSON.stringify(Object.fromEntries(metadataEntries), null, 2)
                          : "—";

                        return (
                          <div
                            key={`${event.type}-${event.timestamp ?? idx}`}
                            className="rounded-lg border border-border/60 bg-card/70 px-3 py-2 text-[11px] text-card-foreground shadow-sm transition-colors hover:border-border hover:bg-card dark:bg-muted/40 dark:hover:bg-muted/60"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground dark:bg-black/30">
                                {event.type}
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                {formattedTimestamp}
                              </span>
                            </div>
                            <div className="mt-2 min-w-0">
                              {metadataDisplay === "—" ? (
                                <span className="text-[10px] italic text-muted-foreground/80">No metadata</span>
                              ) : (
                                <pre className="whitespace-pre-wrap break-words rounded bg-muted/40 px-2 py-1 font-mono text-[10px] leading-snug text-muted-foreground dark:bg-black/30">
                                  {metadataDisplay}
                                </pre>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

