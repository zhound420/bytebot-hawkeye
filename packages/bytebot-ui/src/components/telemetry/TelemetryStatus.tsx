"use client";

import React, { useEffect, useMemo, useState } from "react";
import { TelemetrySummary } from "@/types";

type Props = {
  className?: string;
};

export function TelemetryStatus({ className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<TelemetrySummary | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    setBusy(true);
    fetch("/api/tasks/telemetry/summary", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setData(j))
      .finally(() => setBusy(false))
      .catch(() => setBusy(false));
  };

  const reset = () => {
    setBusy(true);
    fetch("/api/tasks/telemetry/reset", { method: "POST" })
      .then(() => refresh())
      .catch(() => setBusy(false));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  const sparkBars = useMemo(() => {
    const vals = data?.recentAbsDeltas || [];
    if (!vals.length) return null;
    const max = Math.max(...vals);
    return vals.map((v, i) => {
      const h = max > 0 ? Math.max(1, Math.round((v / max) * 16)) : 1;
      return (
        <div
          key={i}
          className="w-[3px] rounded bg-gray-500/50"
          style={{ height: `${h}px` }}
          title={`${v.toFixed(1)} px`}
        />
      );
    });
  }, [data]);

  return (
    <div className={className}>
      {/* Status strip */}
      <div className="flex items-center justify-between rounded-md border border-gray-200 bg-white px-2 py-1 shadow-sm">
        <div className="flex items-center gap-3 text-[11px] text-gray-800">
          <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
            live
          </span>
          <span>
            Targeted: <span className="font-semibold">{data?.targetedClicks ?? 0}</span>
          </span>
          <span>
            Avg Δ: <span className="font-semibold">{data?.avgAbsDelta ?? "-"}</span>
          </span>
          <span>
            Smart: <span className="font-semibold">{data?.smartClicks ?? 0}</span>
          </span>
          <span>
            Zooms: <span className="font-semibold">{data?.progressiveZooms ?? 0}</span>
          </span>
          <div className="ml-1 flex h-4 items-end gap-[2px]">{sparkBars}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50"
            onClick={refresh}
            disabled={busy}
          >
            Refresh
          </button>
          <button
            className="rounded border px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50"
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
            className="flex-1 bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div className="h-full w-[360px] overflow-y-auto bg-white p-3 shadow-xl ring-1 ring-gray-200">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">Desktop Accuracy</h3>
              <div className="flex items-center gap-2">
                <button
                  className="rounded border px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50"
                  onClick={refresh}
                  disabled={busy}
                >
                  Refresh
                </button>
                <button
                  className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100"
                  onClick={reset}
                  disabled={busy}
                >
                  Reset
                </button>
                <button
                  className="rounded border px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Primary metrics */}
            <div className="grid grid-cols-3 gap-2 text-[12px]">
              <div className="rounded-md p-2 ring-1 ring-gray-200">
                <div className="text-[10px] text-gray-500">Targeted</div>
                <div className="text-[14px] font-semibold">{data?.targetedClicks ?? 0}</div>
              </div>
              <div className="rounded-md p-2 ring-1 ring-gray-200">
                <div className="text-[10px] text-gray-500">Untargeted</div>
                <div className="text-[14px] font-semibold">{data?.untargetedClicks ?? 0}</div>
              </div>
              <div className="rounded-md p-2 ring-1 ring-gray-200">
                <div className="text-[10px] text-gray-500">Avg Δ (px)</div>
                <div className="text-[14px] font-semibold">{data?.avgAbsDelta ?? '-'}</div>
              </div>
            </div>

            {/* Chips row 1 */}
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-700">
              <div className="rounded bg-gray-50 px-2 py-1">Keys: <span className="font-medium">{data?.actionCounts?.["type_keys"] ?? 0}</span></div>
              <div className="rounded bg-gray-50 px-2 py-1">Scrolls: <span className="font-medium">{data?.actionCounts?.["scroll"] ?? 0}</span></div>
              <div className="rounded bg-gray-50 px-2 py-1">Screens: <span className="font-medium">{data?.actionCounts?.["screenshot"] ?? 0}</span></div>
            </div>

            {/* Chips row 2 */}
            <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-700">
              <div className="rounded bg-indigo-50 px-2 py-1 text-indigo-700">Smart: <span className="font-medium">{data?.smartClicks ?? 0}</span></div>
              <div className="rounded bg-sky-50 px-2 py-1 text-sky-700">Zooms: <span className="font-medium">{data?.progressiveZooms ?? 0}</span></div>
              <div className="rounded bg-amber-50 px-2 py-1 text-amber-700">Retries: <span className="font-medium">{data?.retryClicks ?? 0}</span></div>
            </div>

            {/* Deltas */}
            <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-700">
              <div className="rounded bg-gray-50 px-2 py-1">Hover Δ avg: <span className="font-medium">{data?.hoverProbes?.avgDiff?.toFixed(2) ?? '-'}</span> ({data?.hoverProbes?.count ?? 0})</div>
              <div className="rounded bg-gray-50 px-2 py-1">Post Δ avg: <span className="font-medium">{data?.postClickDiff?.avgDiff?.toFixed(2) ?? '-'}</span> ({data?.postClickDiff?.count ?? 0})</div>
            </div>

            {/* Large sparkline */}
            {Array.isArray(data?.recentAbsDeltas) && data!.recentAbsDeltas!.length > 0 && (
              <div className="mt-2 flex h-8 items-end gap-[3px]">
                {data!.recentAbsDeltas!.map((v, i) => {
                  const max = Math.max(...(data!.recentAbsDeltas as number[]));
                  const h = max > 0 ? Math.max(2, Math.round((v / max) * 28)) : 2;
                  return (
                    <div key={i} style={{ height: `${h}px` }} className="w-[5px] rounded bg-gray-500/60" title={`${v.toFixed(1)} px`} />
                  );
                })}
              </div>
            )}

            {/* Footer cards */}
            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-gray-700">
              <div className="rounded bg-gray-50 px-2 py-1">Δx: <span className="font-medium">{data?.avgDeltaX ?? '-'}</span></div>
              <div className="rounded bg-gray-50 px-2 py-1">Δy: <span className="font-medium">{data?.avgDeltaY ?? '-'}</span></div>
              <div className="rounded bg-gray-50 px-2 py-1">Calib: <span className="font-medium">{data?.calibrationSnapshots ?? 0}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

