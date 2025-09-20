"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { ChatContainer } from "@/components/messages/ChatContainer";
import { DesktopContainer } from "@/components/ui/desktop-container";
import { useChatSession } from "@/hooks/useChatSession";
import { useScrollScreenshot } from "@/hooks/useScrollScreenshot";
import { useParams, useRouter } from "next/navigation";
import { Role, TaskStatus, TelemetrySummary } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoreVerticalCircle01Icon,
  WavingHand01Icon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { VirtualDesktopStatus } from "@/components/VirtualDesktopStatusHeader";

export default function TaskPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    groupedMessages,
    taskStatus,
    control,
    input,
    setInput,
    isLoading,
    isLoadingSession,
    isLoadingMoreMessages,
    hasMoreMessages,
    loadMoreMessages,
    handleAddMessage,
    handleTakeOverTask,
    handleResumeTask,
    handleCancelTask,
    currentTaskId,
  } = useChatSession({ initialTaskId: taskId });

  // Determine if task is inactive (show screenshot) or active (show VNC)
  function isTaskInactive(): boolean {
    return (
      taskStatus === TaskStatus.COMPLETED ||
      taskStatus === TaskStatus.FAILED ||
      taskStatus === TaskStatus.CANCELLED
    );
  }

  // Determine if user can take control
  function canTakeOver(): boolean {
    return control === Role.ASSISTANT && taskStatus === TaskStatus.RUNNING;
  }

  // Determine if user has control or is in takeover mode
  function hasUserControl(): boolean {
    return (
      control === Role.USER &&
      (taskStatus === TaskStatus.RUNNING ||
        taskStatus === TaskStatus.NEEDS_HELP)
    );
  }

  // Determine if task can be cancelled
  function canCancel(): boolean {
    return (
      taskStatus === TaskStatus.RUNNING || taskStatus === TaskStatus.NEEDS_HELP
    );
  }

  // Determine VNC mode - interactive when user has control, view-only otherwise
  function vncViewOnly(): boolean {
    return !hasUserControl();
  }

  // Use scroll screenshot hook for inactive tasks
  const { currentScreenshot } = useScrollScreenshot({
    messages,
    scrollContainerRef: chatContainerRef,
  });

  // Accuracy telemetry (auto-refresh)
  const [telemetry, setTelemetry] = useState<TelemetrySummary | null>(null);
  // No per‑app filter — report aggregate accuracy
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    const load = () => {
      fetch(`/api/tasks/telemetry/summary`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setTelemetry(data))
        .catch(() => {});
    };
    load();
    timer = setInterval(load, 10000); // refresh every 10s
    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  // For inactive tasks, auto-load all messages for proper screenshot navigation
  useEffect(() => {
    if (isTaskInactive() && hasMoreMessages && !isLoadingMoreMessages) {
      loadMoreMessages();
    }
  }, [
    isTaskInactive(),
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
  ]);

  // Map each message ID to its flat index for screenshot scroll logic
  const messageIdToIndex = React.useMemo(() => {
    const map: Record<string, number> = {};
    messages.forEach((msg, idx) => {
      map[msg.id] = idx;
    });
    return map;
  }, [messages]);

  // Redirect if task ID doesn't match current task
  useEffect(() => {
    if (currentTaskId && currentTaskId !== taskId) {
      router.push(`/tasks/${currentTaskId}`);
    }
  }, [currentTaskId, taskId, router]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <main className="m-2 flex-1 overflow-hidden px-2 py-4">
        <div className="grid h-full grid-cols-7 gap-4">
          {/* Main container */}
          <div className="col-span-4">
            <DesktopContainer
              screenshot={isTaskInactive() ? currentScreenshot : null}
              viewOnly={vncViewOnly()}
              status={
                (() => {
                  if (
                    taskStatus === TaskStatus.RUNNING &&
                    control === Role.USER
                  )
                    return "user_control";
                  if (taskStatus === TaskStatus.RUNNING) return "running";
                  if (taskStatus === TaskStatus.NEEDS_HELP)
                    return "needs_attention";
                  if (taskStatus === TaskStatus.FAILED) return "failed";
                  if (taskStatus === TaskStatus.CANCELLED) return "canceled";
                  if (taskStatus === TaskStatus.COMPLETED) return "completed";
                  // You may want to add a scheduled state if you have that info
                  return "pending";
                })() as VirtualDesktopStatus
              }
            >
              {canTakeOver() && (
                <Button
                  onClick={handleTakeOverTask}
                  variant="default"
                  size="sm"
                  icon={
                    <HugeiconsIcon
                      icon={WavingHand01Icon}
                      className="h-5 w-5"
                    />
                  }
                >
                  Take Over
                </Button>
              )}
              {hasUserControl() && (
                <Button onClick={handleResumeTask} variant="default" size="sm">
                  Proceed
                </Button>
              )}
              {canCancel() && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                      <HugeiconsIcon
                        icon={MoreVerticalCircle01Icon}
                        className="text-bytebot-bronze-light-11 h-5 w-5"
                      />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleCancelTask}
                      className="text-red-600 focus:bg-red-50"
                    >
                      Cancel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </DesktopContainer>
          </div>

          {/* Chat Area */}
          <div className="col-span-3 flex h-full min-h-0 flex-col">
            {/* Accuracy Telemetry Panel */}
            {telemetry && (
              <div className="mb-3 rounded-xl border border-bytebot-bronze-light-5 bg-bytebot-bronze-light-2 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">live</span>
                    <h3 className="text-[13px] font-semibold text-gray-800">Desktop Accuracy</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded border px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        fetch(`/api/tasks/telemetry/summary`)
                          .then((res) => (res.ok ? res.json() : null))
                          .then((data) => setTelemetry(data))
                          .catch(() => {});
                      }}
                      title="Refresh"
                    >
                      Refresh
                    </button>
                    <button
                      className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100"
                      onClick={() => {
                        fetch('/api/tasks/telemetry/reset', { method: 'POST' })
                          .then(() => {
                            fetch(`/api/tasks/telemetry/summary`)
                              .then((res) => (res.ok ? res.json() : null))
                              .then((data) => setTelemetry(data))
                              .catch(() => {});
                          })
                          .catch(() => {});
                      }}
                      title="Reset accuracy stats"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  <div className="rounded-md p-2 ring-1 ring-gray-200">
                    <div className="text-[10px] text-gray-500">Targeted</div>
                    <div className="text-[14px] font-semibold">{telemetry.targetedClicks}</div>
                  </div>
                  <div className="rounded-md p-2 ring-1 ring-gray-200">
                    <div className="text-[10px] text-gray-500">Untargeted</div>
                    <div className="text-[14px] font-semibold">{telemetry.untargetedClicks}</div>
                  </div>
                  <div className="rounded-md p-2 ring-1 ring-gray-200">
                    <div className="text-[10px] text-gray-500">Avg Δ (px)</div>
                    <div className="text-[14px] font-semibold">{telemetry.avgAbsDelta ?? '-'}</div>
                  </div>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-700">
                  <div className="rounded bg-gray-50 px-2 py-1">Keys: <span className="font-medium">{telemetry.actionCounts?.["type_keys"] ?? 0}</span></div>
                  <div className="rounded bg-gray-50 px-2 py-1">Scrolls: <span className="font-medium">{telemetry.actionCounts?.["scroll"] ?? 0}</span></div>
                  <div className="rounded bg-gray-50 px-2 py-1">Screens: <span className="font-medium">{telemetry.actionCounts?.["screenshot"] ?? 0}</span></div>
                </div>
                <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-700">
                  <div className="rounded bg-indigo-50 px-2 py-1 text-indigo-700" title="Successful smart click completions">
                    Smart (completed): <span className="font-medium">{telemetry.smartClicks ?? 0}</span>
                  </div>
                  <div className="rounded bg-sky-50 px-2 py-1 text-sky-700">Zooms: <span className="font-medium">{telemetry.progressiveZooms ?? 0}</span></div>
                  <div className="rounded bg-amber-50 px-2 py-1 text-amber-700">Retries: <span className="font-medium">{telemetry.retryClicks ?? 0}</span></div>
                </div>
                <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-700">
                  <div className="rounded bg-gray-50 px-2 py-1">Hover Δ avg: <span className="font-medium">{telemetry.hoverProbes?.avgDiff?.toFixed(2) ?? '-'}</span> ({telemetry.hoverProbes?.count ?? 0})</div>
                  <div className="rounded bg-gray-50 px-2 py-1">Post Δ avg: <span className="font-medium">{telemetry.postClickDiff?.avgDiff?.toFixed(2) ?? '-'}</span> ({telemetry.postClickDiff?.count ?? 0})</div>
                </div>
                {Array.isArray(telemetry.recentAbsDeltas) && telemetry.recentAbsDeltas.length > 0 && (
                  <div className="mt-2 flex h-4 items-end gap-[2px]">
                    {telemetry.recentAbsDeltas.map((v, i) => {
                      const max = Math.max(...telemetry.recentAbsDeltas!);
                      const h = max > 0 ? Math.max(1, Math.round((v / max) * 16)) : 1;
                      return (
                        <div key={i} style={{ height: `${h}px` }} className="w-[4px] rounded bg-gray-500/50" title={`${v.toFixed(1)} px`} />
                      );
                    })}
                  </div>
                )}
                <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-gray-700">
                  <div className="rounded bg-gray-50 px-2 py-1">Δx: <span className="font-medium">{telemetry.avgDeltaX ?? '-'}</span></div>
                  <div className="rounded bg-gray-50 px-2 py-1">Δy: <span className="font-medium">{telemetry.avgDeltaY ?? '-'}</span></div>
                  <div className="rounded bg-gray-50 px-2 py-1">Calib: <span className="font-medium">{telemetry.calibrationSnapshots}</span></div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-gray-500">Targeted</div>
                    <div className="font-medium">{telemetry.targetedClicks}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Untargeted</div>
                    <div className="font-medium">{telemetry.untargetedClicks}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Avg Δ (px)</div>
                    <div className="font-medium">{telemetry.avgAbsDelta ?? "-"}</div>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-3 text-xs text-gray-600">
                  <div>Δx: {telemetry.avgDeltaX ?? "-"}</div>
                  <div>Δy: {telemetry.avgDeltaY ?? "-"}</div>
                  <div>Calib: {telemetry.calibrationSnapshots}</div>
                </div>
                {telemetry.actionCounts && (
                  <div className="mt-1 grid grid-cols-3 gap-3 text-xs text-gray-600">
                    <div>Keys: {telemetry.actionCounts["type_keys"] ?? 0}</div>
                    <div>Scrolls: {telemetry.actionCounts["scroll"] ?? 0}</div>
                    <div>Screens: {telemetry.actionCounts["screenshot"] ?? 0}</div>
                  </div>
                )}
                <div className="mt-1 grid grid-cols-2 gap-3 text-xs text-gray-600">
                  <div>Smart clicks (completed): {telemetry.smartClicks ?? 0}</div>
                  <div>Prog. zooms: {telemetry.progressiveZooms ?? 0}</div>
                </div>
                {telemetry.hoverProbes && (
                  <div className="mt-1 grid grid-cols-2 gap-3 text-xs text-gray-600">
                    <div>Hover probes: {telemetry.hoverProbes.count}</div>
                    <div>Hover Δ avg: {telemetry.hoverProbes.avgDiff?.toFixed(2) ?? "-"}</div>
                  </div>
                )}
                {telemetry.postClickDiff && (
                  <div className="mt-1 grid grid-cols-2 gap-3 text-xs text-gray-600">
                    <div>Post‑click checks: {telemetry.postClickDiff.count}</div>
                    <div>Post Δ avg: {telemetry.postClickDiff.avgDiff?.toFixed(2) ?? "-"}</div>
                  </div>
                )}
                {Array.isArray(telemetry.recentAbsDeltas) && telemetry.recentAbsDeltas.length > 0 && (
                  <div className="mt-2 flex h-6 items-end gap-[2px]">
                    {telemetry.recentAbsDeltas.map((v, i) => {
                      const max = Math.max(...telemetry.recentAbsDeltas!);
                      const h = max > 0 ? Math.max(2, Math.round((v / max) * 20)) : 2;
                      return (
                        <div
                          key={i}
                          style={{ height: `${h}px` }}
                          className="w-[6px] rounded bg-gray-500/50"
                          title={`${v.toFixed(1)} px`}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {/* Messages scrollable area */}
            <div
              ref={chatContainerRef}
              className="hide-scrollbar min-h-0 flex-1 overflow-scroll px-4"
            >
              <ChatContainer
                scrollRef={chatContainerRef}
                messageIdToIndex={messageIdToIndex}
                taskId={taskId}
                input={input}
                setInput={setInput}
                isLoading={isLoading}
                handleAddMessage={handleAddMessage}
                groupedMessages={groupedMessages}
                taskStatus={taskStatus}
                control={control}
                isLoadingSession={isLoadingSession}
                isLoadingMoreMessages={isLoadingMoreMessages}
                hasMoreMessages={hasMoreMessages}
                loadMoreMessages={loadMoreMessages}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
