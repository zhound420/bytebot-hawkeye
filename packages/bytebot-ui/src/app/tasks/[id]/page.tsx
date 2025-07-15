"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { ChatContainer } from "@/components/messages/ChatContainer";
import { DesktopContainer } from "@/components/ui/desktop-container";
import { ChatInput } from "@/components/messages/ChatInput";
import { useChatSession } from "@/hooks/useChatSession";
import { useScrollScreenshot } from "@/hooks/useScrollScreenshot";
import { useParams, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Role, TaskStatus, Model } from "@/types";
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
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
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
    handleGuideTask,
    handleTakeOverTask,
    handleResumeTask,
    handleCancelTask,
    currentTaskId,
  } = useChatSession({ initialTaskId: taskId });

  // Determine if task is inactive (show screenshot) or active (show VNC)
  const isTaskInactive =
    taskStatus === TaskStatus.COMPLETED ||
    taskStatus === TaskStatus.FAILED ||
    taskStatus === TaskStatus.CANCELLED;

  // Determine if user can take control
  const canTakeOver =
    control === Role.ASSISTANT && taskStatus === TaskStatus.RUNNING;

  // Determine if user has control or is in takeover mode
  const hasUserControl =
    control === Role.USER && taskStatus === TaskStatus.RUNNING;

  // Determine if task can be cancelled
  const canCancel =
    taskStatus === TaskStatus.RUNNING || taskStatus === TaskStatus.NEEDS_HELP;

  // Determine VNC mode - interactive when user has control, view-only otherwise
  const vncViewOnly = !hasUserControl;

  // Use scroll screenshot hook for inactive tasks
  const { currentScreenshot } = useScrollScreenshot({
    messages,
    scrollContainerRef: chatContainerRef,
  });

  // Map each message ID to its flat index for screenshot scroll logic
  const messageIdToIndex = React.useMemo(() => {
    const map: Record<string, number> = {};
    messages.forEach((msg, idx) => {
      map[msg.id] = idx;
    });
    return map;
  }, [messages]);

  useEffect(() => {
    fetch("/api/tasks/models")
      .then((res) => res.json())
      .then((data) => {
        setModels(data);
        if (data.length > 0) setSelectedModel(data[0]);
      })
      .catch((err) => console.error("Failed to load models", err));
  }, []);

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
              screenshot={isTaskInactive ? currentScreenshot : null}
              viewOnly={vncViewOnly}
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
              {canTakeOver && (
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
              {hasUserControl && (
                <Button onClick={handleResumeTask} variant="default" size="sm">
                  Proceed
                </Button>
              )}
              {canCancel && (
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
          <div
            ref={chatContainerRef}
            className="col-span-3 flex h-full flex-col overflow-scroll"
          >
            {/* Messages scrollable area */}
            <div className="h-full flex-1 px-4 pb-2">
              <ChatContainer
                taskStatus={taskStatus}
                groupedMessages={groupedMessages}
                isLoadingSession={isLoadingSession}
                isLoadingMoreMessages={isLoadingMoreMessages}
                hasMoreMessages={hasMoreMessages}
                loadMoreMessages={loadMoreMessages}
                scrollRef={chatContainerRef}
                control={control}
                messageIdToIndex={messageIdToIndex}
              />
            </div>

            {/* Fixed chat input */}
            {taskStatus === TaskStatus.NEEDS_HELP && (
              <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-7 shadow-rounded-2xl border p-2">
                <ChatInput
                  input={input}
                  isLoading={isLoading}
                  onInputChange={setInput}
                  onSend={handleGuideTask}
                  minLines={1}
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
                      <SelectValue placeholder="Select an model" />
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
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
