import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

// Status types based on the image
export type VirtualDesktopStatus =
  | "running"
  | "needs_attention"
  | "failed"
  | "canceled"
  | "scheduled"
  | "user_control";

interface StatusConfig {
  dot: React.ReactNode;
  text: string;
  gradient: string;
  subtext: string;
}

const statusConfig: Record<VirtualDesktopStatus, StatusConfig> = {
  running: {
    dot: (
      <span className="flex items-center justify-center">
        <Image
          src="/indicators/indicator-green.png"
          alt="Running status"
          width={15}
          height={15}
        />
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "from-green-700 to-green-900",
    subtext: "Running...",
  },
  needs_attention: {
    dot: (
      <span className="flex items-center justify-center">
        <Image
          src="/indicators/indicator-orange.png"
          alt="Needs attention status"
          width={15}
          height={15}
        />
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "from-yellow-600 to-orange-700",
    subtext: "Needs Attention",
  },
  failed: {
    dot: (
      <span className="flex items-center justify-center">
        <Image
          src="/indicators/indicator-red.png"
          alt="Failed status"
          width={15}
          height={15}
        />
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "from-red-700 to-red-900",
    subtext: "Failed",
  },
  canceled: {
    dot: (
      <span className="flex items-center justify-center">
        <Image
          src="/indicators/indicator-gray.png"
          alt="Canceled status"
          width={15}
          height={15}
        />
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "",
    subtext: "Canceled",
  },
  scheduled: {
    dot: (
      <span className="flex items-center justify-center">
        <Image
          src="/indicators/indicator-gray.png"
          alt="Scheduled status"
          width={15}
          height={15}
        />
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "",
    subtext: "Scheduled at 3am today",
  },
  user_control: {
    dot: (
      <span className="flex items-center justify-center">
        <Image
          src="/indicators/indicator-pink.png"
          alt="User control status"
          width={15}
          height={15}
        />
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "from-pink-500 to-fuchsia-700",
    subtext: "You took control",
  },
};

export interface VirtualDesktopStatusHeaderProps {
  status: VirtualDesktopStatus;
  subtext?: string; // allow override
  className?: string;
}

export const VirtualDesktopStatusHeader: React.FC<VirtualDesktopStatusHeaderProps> = ({
  status,
  subtext,
  className,
}) => {
  const config = statusConfig[status];
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <span className="flex items-center justify-center mt-1">
        {config.dot}
      </span>
      <div>
        <span
            className={cn(
              "text-md font-semibold text-base",
              config.gradient 
                ? "bg-clip-text text-transparent" 
                : "text-zinc-600"
            )}
            style={config.gradient ? {
              backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`,
            } : undefined}
        >
            <span className={cn(
              config.gradient ? `bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent` : ""
            )}>
            {config.text}
            </span>
        </span>
        {config.subtext && (
            <span className="block text-[12px] text-zinc-400">
            {subtext || config.subtext}
            </span>
        )}
      </div>
    </div>
  );
}; 