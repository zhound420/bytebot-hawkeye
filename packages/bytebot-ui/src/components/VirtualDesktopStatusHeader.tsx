import React from "react";
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
        {/* Provided SVG for green dot */}
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 15 15" fill="none">
          <path d="M7.5 0.375C10.8827 0.375 13.625 3.11726 13.625 6.5C13.625 9.88274 10.8827 12.625 7.5 12.625C4.11726 12.625 1.375 9.88274 1.375 6.5C1.375 3.11726 4.11726 0.375 7.5 0.375Z" stroke="#2B8000" strokeOpacity="0.2" strokeWidth="0.75"/>
          <g filter="url(#filter0_di_3756_14589)">
            <circle cx="7.5" cy="6.5" r="3.5" fill="#4DAF29"/>
            <circle cx="7.5" cy="6.5" r="3.125" stroke="black" strokeWidth="0.75" style={{ mixBlendMode: 'overlay' }}/>
          </g>
          <defs>
            <filter id="filter0_di_3756_14589" x="0" y="0" width="15" height="15" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
              <feFlood floodOpacity="0" result="BackgroundImageFix"/>
              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
              <feOffset dy="1"/>
              <feGaussianBlur stdDeviation="2"/>
              <feComposite in2="hardAlpha" operator="out"/>
              <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0.372549 0 0 0 0 0 0 0 0 0.6 0"/>
              <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_3756_14589"/>
              <feBlend mode="normal" in="SourceGraphic" in2="effect1_dropShadow_3756_14589" result="shape"/>
              <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
              <feOffset dy="2"/>
              <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1"/>
              <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.4 0"/>
              <feBlend mode="normal" in2="shape" result="effect2_innerShadow_3756_14589"/>
            </filter>
          </defs>
        </svg>
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "from-green-700 to-green-900",
    subtext: "Running...",
  },
  needs_attention: {
    dot: (
      <span className="flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7.5" cy="7.5" r="7" stroke="#FFB800" strokeOpacity="0.2" strokeWidth="0.75"/>
          <circle cx="7.5" cy="7.5" r="4.5" fill="#FFB800"/>
        </svg>
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "from-yellow-600 to-orange-700",
    subtext: "Needs Attention",
  },
  failed: {
    dot: (
      <span className="flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7.5" cy="7.5" r="7" stroke="#B80000" strokeOpacity="0.2" strokeWidth="0.75"/>
          <circle cx="7.5" cy="7.5" r="4.5" fill="#B80000"/>
        </svg>
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "from-red-700 to-red-900",
    subtext: "Failed",
  },
  canceled: {
    dot: (
      <span className="flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7.5" cy="7.5" r="7" stroke="#A0A0A0" strokeOpacity="0.2" strokeWidth="0.75"/>
          <circle cx="7.5" cy="7.5" r="4.5" fill="#A0A0A0"/>
        </svg>
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "from-zinc-400 to-zinc-600",
    subtext: "Canceled",
  },
  scheduled: {
    dot: (
      <span className="flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7.5" cy="7.5" r="7" stroke="#A0A0A0" strokeOpacity="0.2" strokeWidth="0.75"/>
          <circle cx="7.5" cy="7.5" r="4.5" fill="#A0A0A0"/>
        </svg>
      </span>
    ),
    text: "Virtual Desktop",
    gradient: "from-zinc-400 to-zinc-600",
    subtext: "Scheduled at 3am today",
  },
  user_control: {
    dot: (
      <span className="flex items-center justify-center">
        <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="7.5" cy="7.5" r="7" stroke="#E600FF" strokeOpacity="0.2" strokeWidth="0.75"/>
          <circle cx="7.5" cy="7.5" r="4.5" fill="#E600FF"/>
        </svg>
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
            className="text-md font-semibold bg-clip-text text-transparent text-base"
            style={{
            backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`,
            }}
        >
            <span className={cn(`bg-gradient-to-r ${config.gradient} bg-clip-text text-transparent`)}>
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