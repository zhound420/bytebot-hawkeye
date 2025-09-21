"use client";

import React from "react";
import { Header } from "@/components/layout/Header";
import { DesktopContainer } from "@/components/ui/desktop-container";
import { fetchTasks } from "@/utils/taskUtils";
import { Task, TaskStatus } from "@/types";
import { getTaskModelLabel } from "@/components/tasks/TaskItem";

const ACTIVE_TASK_STATUSES: TaskStatus[] = [
  TaskStatus.PENDING,
  TaskStatus.RUNNING,
  TaskStatus.NEEDS_HELP,
  TaskStatus.NEEDS_REVIEW,
];

export default function DesktopPage() {
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);

  React.useEffect(() => {
    let isMounted = true;

    const loadActiveTask = async () => {
      try {
        const result = await fetchTasks({
          statuses: ACTIVE_TASK_STATUSES,
          limit: 1,
        });

        if (!isMounted) return;
        setActiveTask(result.tasks[0] ?? null);
      } catch (error) {
        console.error("Failed to fetch active task:", error);
        if (!isMounted) return;
        setActiveTask(null);
      }
    };

    void loadActiveTask();

    return () => {
      isMounted = false;
    };
  }, []);

  const modelLabel = React.useMemo(
    () => (activeTask ? getTaskModelLabel(activeTask) : null),
    [activeTask]
  );

  const modelNameDetails = React.useMemo(() => {
    if (!activeTask?.model) return undefined;

    const title = activeTask.model.title?.trim();
    const name = activeTask.model.name?.trim();

    if (title && name && title !== name) {
      return name;
    }

    return undefined;
  }, [activeTask]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <main className="m-2 flex-1 overflow-hidden px-2 py-4">
        <div className="flex h-full items-center justify-center">
          {/* Main container */}
          <div className="w-[60%] space-y-4">
            <div className="mb-4 flex flex-col gap-1 rounded-lg border border-border bg-card px-4 py-3 dark:border-border/60 dark:bg-muted">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Active Model
              </span>
              <span className="text-sm font-semibold text-foreground">
                {modelLabel || "Model unavailable"}
              </span>
              {modelNameDetails && (
                <span className="text-xs text-muted-foreground">
                  Identifier: {modelNameDetails}
                </span>
              )}
            </div>
            <DesktopContainer viewOnly={false} status="live_view">
              {/* No action buttons for desktop page */}
            </DesktopContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
