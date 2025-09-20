"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { Header } from "@/components/layout/Header";
import { ChatInput } from "@/components/messages/ChatInput";
import { useRouter } from "next/navigation";
import { startTask } from "@/utils/taskUtils";
import { Model, TelemetrySummary } from "@/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskList } from "@/components/tasks/TaskList";
import { TelemetryStatus } from "@/components/telemetry/TelemetryStatus";

interface StockPhotoProps {
  src: string;
  alt?: string;
}

const StockPhoto: React.FC<StockPhotoProps> = ({
  src,
  alt = "Decorative image",
}) => {
  return (
    <div className="h-full w-full overflow-hidden rounded-lg bg-white">
      <div className="relative h-full w-full">
        <Image src={src} alt={alt} fill className="object-cover" priority />
      </div>
    </div>
  );
};

interface FileWithBase64 {
  name: string;
  base64: string;
  type: string;
  size: number;
}

export default function Home() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [telemetry, setTelemetry] = useState<TelemetrySummary | null>(null);
  // No per‑app filter — report aggregate accuracy
  const [uploadedFiles, setUploadedFiles] = useState<FileWithBase64[]>([]);
  const router = useRouter();
  const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(
    null,
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/tasks/models")
      .then((res) => res.json())
      .then((data) => {
        setModels(data);
        if (data.length > 0) setSelectedModel(data[0]);
      })
      .catch((err) => console.error("Failed to load models", err));
    refreshTelemetry();
    // Auto-refresh telemetry every 10s
    const t = setInterval(() => refreshTelemetry(), 10000);
    return () => clearInterval(t);
  }, []);

  const refreshTelemetry = () => {
    fetch(`/api/tasks/telemetry/summary`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setTelemetry(data))
      .catch((err) => console.error("Failed to load telemetry summary", err));
  };

  // Close popover when clicking outside or pressing ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonsRef.current &&
        !buttonsRef.current.contains(event.target as Node)
      ) {
        setActivePopoverIndex(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePopoverIndex(null);
      }
    };

    if (activePopoverIndex !== null) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activePopoverIndex]);

  const handleSend = async () => {
    if (!input.trim()) return;

    setIsLoading(true);

    try {
      if (!selectedModel) throw new Error("No model selected");
      // Send request to start a new task
      const taskData: {
        description: string;
        model: Model;
        files?: FileWithBase64[];
      } = {
        description: input,
        model: selectedModel,
      };

      // Include files if any are uploaded
      if (uploadedFiles.length > 0) {
        taskData.files = uploadedFiles;
      }

      const task = await startTask(taskData);

      if (task && task.id) {
        // Redirect to the task page
        router.push(`/tasks/${task.id}`);
      } else {
        // Handle error
        console.error("Failed to create task");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (files: FileWithBase64[]) => {
    setUploadedFiles(files);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Desktop grid layout (50/50 split) - only visible on large screens */}
        <div className="hidden h-full p-8 lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Main content area */}
          <div className="flex flex-col items-center overflow-y-auto">
            <div className="flex w-full max-w-xl flex-col items-center">
              <div className="mb-6 flex w-full flex-col items-start justify-start">
                <h1 className="text-bytebot-bronze-light-12 mb-1 text-2xl">
                  What can I help you get done?
                </h1>
              </div>

              <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-7 mb-10 w-full rounded-2xl border p-2">
                <ChatInput
                  input={input}
                  isLoading={isLoading}
                  onInputChange={setInput}
                  onSend={handleSend}
                  onFileUpload={handleFileUpload}
                  minLines={3}
                />
                <div className="mt-2">
                  <Select
                    value={selectedModel?.name}
                    onValueChange={(val) =>
                      setSelectedModel(
                        models.find((m) => m.name === val) || null,
                      )
                    }
                  >
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TelemetryStatus className="mb-3 w-full" />
              <TaskList
                className="w-full"
                title="Latest Tasks"
                description="You'll see tasks that are completed, scheduled, or require your attention."
              />
              {/* Accuracy Telemetry Panel */}
              {telemetry && (
                <div className="mt-4 w-full rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">live</span>
                      <h3 className="text-[13px] font-semibold text-gray-800">Desktop Accuracy</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="rounded border px-2 py-0.5 text-[11px] text-gray-700 hover:bg-gray-50" onClick={refreshTelemetry}>Refresh</button>
                      <button className="rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-100" onClick={() => { fetch('/api/tasks/telemetry/reset', { method: 'POST' }).then(() => refreshTelemetry()).catch(() => {}); }}>Reset</button>
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
                    <div className="rounded bg-indigo-50 px-2 py-1 text-indigo-700">Smart: <span className="font-medium">{telemetry.smartClicks ?? 0}</span></div>
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
                </div>
              )}
            </div>
          </div>

          {/* Stock photo area - centered in its grid cell */}
          <div className="flex items-center justify-center px-6 pt-6">
            <div className="aspect-square h-full w-full max-w-md xl:max-w-2xl">
              <StockPhoto src="/stock-1.png" alt="Bytebot stock image" />
            </div>
          </div>
        </div>

        {/* Mobile layout - only visible on small/medium screens */}
        <div className="flex h-full flex-col lg:hidden">
          <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pt-10">
            <div className="flex w-full max-w-xl flex-col items-center pb-10">
              <div className="mb-6 flex w-full flex-col items-start justify-start">
                <h1 className="text-bytebot-bronze-light-12 mb-1 text-2xl">
                  What can I help you get done?
                </h1>
              </div>

              <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-5 borderw-full mb-10 rounded-2xl p-2">
                <ChatInput
                  input={input}
                  isLoading={isLoading}
                  onInputChange={setInput}
                  onSend={handleSend}
                  onFileUpload={handleFileUpload}
                  minLines={3}
                />
                <div className="mt-2">
                  <Select
                    value={selectedModel?.name}
                    onValueChange={(val) =>
                      setSelectedModel(
                        models.find((m) => m.name === val) || null,
                      )
                    }
                  >
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.name} value={m.name}>
                          {m.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <TaskList
                className="w-full"
                title="Latest Tasks"
                description="You'll see tasks that are completed, scheduled, or require your attention."
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
