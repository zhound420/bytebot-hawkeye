import React from "react";
import { TelemetrySummary } from "@/types";
import { cn } from "@/lib/utils";

interface AccuracyPanelProps {
  telemetry: TelemetrySummary | null;
  onRefresh: () => void;
  onReset: () => void;
  className?: string;
}

export const AccuracyPanel: React.FC<AccuracyPanelProps> = ({
  telemetry,
  onRefresh,
  onReset,
  className,
}) => {
  if (!telemetry) {
    return null;
  }

  const recentAbsDeltas = Array.isArray(telemetry.recentAbsDeltas)
    ? telemetry.recentAbsDeltas
    : [];
  const maxRecentAbsDelta =
    recentAbsDeltas.length > 0 ? Math.max(...recentAbsDeltas) : 0;

  return (
    <div
      className={cn(
        "w-full rounded-xl border border-gray-200 bg-white p-3 shadow-sm",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">
            live
          </span>
          <h3 className="text-[13px] font-semibold text-gray-800">
            Desktop Accuracy
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50"
            onClick={onRefresh}
          >
            Refresh
          </button>
          <button
            className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100"
            onClick={onReset}
          >
            Reset
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-[12px]">
        <div className="rounded-md p-2 ring-1 ring-gray-200">
          <div className="text-[10px] text-gray-500">Targeted</div>
          <div className="text-[14px] font-semibold">
            {telemetry.targetedClicks}
          </div>
        </div>
        <div className="rounded-md p-2 ring-1 ring-gray-200">
          <div className="text-[10px] text-gray-500">Untargeted</div>
          <div className="text-[14px] font-semibold">
            {telemetry.untargetedClicks}
          </div>
        </div>
        <div className="rounded-md p-2 ring-1 ring-gray-200">
          <div className="text-[10px] text-gray-500">Avg Δ (px)</div>
          <div className="text-[14px] font-semibold">
            {telemetry.avgAbsDelta ?? "-"}
          </div>
        </div>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-700">
        <div className="rounded bg-gray-50 px-2 py-1">
          Keys: <span className="font-medium">{telemetry.actionCounts?.["type_keys"] ?? 0}</span>
        </div>
        <div className="rounded bg-gray-50 px-2 py-1">
          Scrolls: <span className="font-medium">{telemetry.actionCounts?.["scroll"] ?? 0}</span>
        </div>
        <div className="rounded bg-gray-50 px-2 py-1">
          Screens: <span className="font-medium">{telemetry.actionCounts?.["screenshot"] ?? 0}</span>
        </div>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-700">
        <div
          className="rounded bg-indigo-50 px-2 py-1 text-indigo-700"
          title="Successful smart click completions"
        >
          Smart (completed):{" "}
          <span className="font-medium">{telemetry.smartClicks ?? 0}</span>
        </div>
        <div className="rounded bg-sky-50 px-2 py-1 text-sky-700">
          Zooms: <span className="font-medium">{telemetry.progressiveZooms ?? 0}</span>
        </div>
        <div className="rounded bg-amber-50 px-2 py-1 text-amber-700">
          Retries: <span className="font-medium">{telemetry.retryClicks ?? 0}</span>
        </div>
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-700">
        <div className="rounded bg-gray-50 px-2 py-1">
          Hover Δ avg:{" "}
          <span className="font-medium">
            {telemetry.hoverProbes?.avgDiff?.toFixed(2) ?? "-"}
          </span>{" "}
          ({telemetry.hoverProbes?.count ?? 0})
        </div>
        <div className="rounded bg-gray-50 px-2 py-1">
          Post Δ avg:{" "}
          <span className="font-medium">
            {telemetry.postClickDiff?.avgDiff?.toFixed(2) ?? "-"}
          </span>{" "}
          ({telemetry.postClickDiff?.count ?? 0})
        </div>
      </div>
      {recentAbsDeltas.length > 0 && (
        <div className="mt-2 flex h-4 items-end gap-[2px]">
          {recentAbsDeltas.map((value, index) => {
            const height =
              maxRecentAbsDelta > 0
                ? Math.max(1, Math.round((value / maxRecentAbsDelta) * 16))
                : 1;
            return (
              <div
                key={index}
                style={{ height: `${height}px` }}
                className="w-[4px] rounded bg-gray-500/50"
                title={`${value.toFixed(1)} px`}
              />
            );
          })}
        </div>
      )}
      <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-700">
        <div className="rounded bg-gray-50 px-2 py-1">
          Δx: <span className="font-medium">{telemetry.avgDeltaX ?? "-"}</span>
        </div>
        <div className="rounded bg-gray-50 px-2 py-1">
          Δy: <span className="font-medium">{telemetry.avgDeltaY ?? "-"}</span>
        </div>
        <div className="rounded bg-gray-50 px-2 py-1">
          Calib: <span className="font-medium">{telemetry.calibrationSnapshots}</span>
        </div>
      </div>
    </div>
  );
};

