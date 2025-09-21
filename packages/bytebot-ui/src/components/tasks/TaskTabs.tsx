import React from "react";
import { TaskStatus } from "@/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  CursorProgress04Icon,
  MultiplicationSignIcon,
  ListViewIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

type TabKey = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED_FAILED";

interface TaskTabsProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  taskCounts: Record<TabKey, number>;
}

interface TabConfig {
  label: string;
  icon:
    | typeof Tick02Icon
    | typeof CursorProgress04Icon
    | typeof MultiplicationSignIcon
    | typeof ListViewIcon;
  statuses: TaskStatus[];
}

const TAB_CONFIGS: Record<TabKey, TabConfig> = {
  ALL: {
    label: "All",
    icon: ListViewIcon,
    statuses: Object.values(TaskStatus),
  },
  ACTIVE: {
    label: "Active",
    icon: CursorProgress04Icon,
    statuses: [
      TaskStatus.PENDING,
      TaskStatus.RUNNING,
      TaskStatus.NEEDS_HELP,
      TaskStatus.NEEDS_REVIEW,
    ],
  },
  COMPLETED: {
    label: "Completed",
    icon: Tick02Icon,
    statuses: [TaskStatus.COMPLETED],
  },
  CANCELLED_FAILED: {
    label: "Cancelled/Failed",
    icon: MultiplicationSignIcon,
    statuses: [TaskStatus.CANCELLED, TaskStatus.FAILED],
  },
};

export const TaskTabs: React.FC<TaskTabsProps> = ({
  activeTab,
  onTabChange,
  taskCounts,
}) => {
  const tabs = Object.entries(TAB_CONFIGS) as [TabKey, TabConfig][];

  return (
    <div className="mb-6 border-b border-border">
      <div className="flex overflow-x-auto">
        {tabs.map(([tabKey, config]) => {
          const isActive = activeTab === tabKey;
          const count = taskCounts[tabKey] || 0;

          return (
            <button
              key={tabKey}
              onClick={() => onTabChange(tabKey)}
              className={cn(
                "flex cursor-pointer items-center space-x-2 whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors",
                isActive && "border-primary text-foreground",
                !isActive && "hover:text-foreground"
              )}
            >
              <HugeiconsIcon
                icon={config.icon}
                className={cn(
                  "h-4 w-4",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              />
              <span>{config.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-xs font-medium",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-muted-foreground dark:bg-accent/40"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Export the TabKey type and TAB_CONFIGS for use in other components
export type { TabKey };
export { TAB_CONFIGS };
