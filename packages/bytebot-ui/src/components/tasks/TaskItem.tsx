import React from "react";
import { Task, TaskStatus } from "@/types";
import { format } from "date-fns";
import { capitalizeFirstChar } from "@/utils/stringUtils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  Cancel01Icon,
  Loading03Icon,
  MessageQuestionIcon,
} from "@hugeicons/core-free-icons";
import Link from "next/link";

interface TaskItemProps {
  task: Task;
}

interface StatusBadgeConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any; // HugeIcons IconSvgObject type
  text: string;
  containerClasses: string;
  iconClasses: string;
  textClasses: string;
  animate?: boolean;
}

const STATUS_CONFIGS: Record<TaskStatus, StatusBadgeConfig> = {
  [TaskStatus.COMPLETED]: {
    icon: Tick02Icon,
    text: "Success",
    containerClasses: "bg-bytebot-green-3 border-bytebot-green-a5",
    iconClasses: "text-bytebot-green-9",
    textClasses: "text-bytebot-green-11",
  },
  [TaskStatus.RUNNING]: {
    icon: Loading03Icon,
    text: "Running",
    containerClasses: "border-orange-700 bg-orange-100",
    iconClasses: "text-orange-900",
    textClasses: "text-orange-700",
    animate: true,
  },
  [TaskStatus.NEEDS_HELP]: {
    icon: MessageQuestionIcon,
    text: "Needs Guidance",
    containerClasses: "border-blue-700 bg-blue-100",
    iconClasses: "text-blue-900",
    textClasses: "text-blue-700",
  },
  [TaskStatus.PENDING]: {
    icon: Loading03Icon,
    text: "Pending",
    containerClasses: "border-yellow-700 bg-yellow-100",
    iconClasses: "text-yellow-900",
    textClasses: "text-yellow-700",
    animate: true,
  },
  [TaskStatus.FAILED]: {
    icon: Cancel01Icon,
    text: "Failed",
    containerClasses: "bg-bytebot-red-light-3 border-bytebot-red-light-7",
    iconClasses: "text-bytebot-red-light-9",
    textClasses: "text-bytebot-red-light-9",
  },
  [TaskStatus.NEEDS_REVIEW]: {
    icon: MessageQuestionIcon,
    text: "Needs Review",
    containerClasses: "border-purple-700 bg-purple-100",
    iconClasses: "text-purple-900",
    textClasses: "text-purple-700",
  },
  [TaskStatus.CANCELLED]: {
    icon: Cancel01Icon,
    text: "Cancelled",
    containerClasses: "border-gray-700 bg-gray-100",
    iconClasses: "text-gray-900",
    textClasses: "text-gray-700",
  },
};

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  // Format date to match the screenshot (e.g., "Today 9:13am" or "April 13, 2025, 12:01pm")
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();

    const isToday = 
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();

    const formatString = isToday 
      ? `'Today' h:mma`
      : "MMMM d, yyyy, h:mma";

    const formatted = format(date, formatString).toLowerCase();
    return capitalizeFirstChar(formatted);
  };

  const StatusBadge = ({ status }: { status: TaskStatus }) => {
    const config = STATUS_CONFIGS[status];
    if (!config) return null;

    const { icon, text, containerClasses, iconClasses, textClasses, animate } = config;

    return (
      <div className={`inline-flex w-fit items-center space-x-1 rounded-full border px-1.5 py-0.5 ${containerClasses}`}>
        <HugeiconsIcon
          icon={icon}
          className={`mr-1 h-4 w-4 ${iconClasses} ${animate ? 'animate-[spin_3s_linear_infinite]' : ''}`}
        />
        <span className={`text-[11px] ${textClasses}`}>{text}</span>
      </div>
    );
  };

  return (
    <Link href={`/tasks/${task.id}`} className="block">
      <div className="shadow-bytebot bg-bytebot-bronze-light-2 border-bytebot-bronze-light-5 hover:bg-bytebot-bronze-light-3 flex min-h-24 items-start rounded-lg border-[0.5px] px-5 py-4 transition-colors">
        <div className="flex-1 space-y-2">
          <div className="text-byhtebot-bronze-dark-7 text-sm font-medium">
            {capitalizeFirstChar(task.description)}
          </div>
          <div className="text-byhtebot-bronze-dark-11 text-xs flex items-center justify-start space-x-1.5">
            <span className="text-byhtebot-bronze-dark-9">
              {formatDate(task.createdAt)}
            </span>
            {task.user && (
              <>
                <span className="text-byhtebot-bronze-dark-9">
                  •
                </span>
                <span className="text-byhtebot-bronze-dark-9">
                  {task.user.name || task.user.email}
                </span>
              </>
            )}
          </div>
          <StatusBadge status={task.status} />
        </div>
      </div>
    </Link>
  );
};
