import React, { useRef, useEffect, useState } from "react";
import { VncViewer } from "@/components/vnc/VncViewer";
import { ScreenshotViewer } from "@/components/screenshot/ScreenshotViewer";
import { ScreenshotData } from "@/utils/screenshotUtils";
import {
  VirtualDesktopStatusHeader,
  VirtualDesktopStatus,
} from "@/components/VirtualDesktopStatusHeader";

interface DesktopContainerProps {
  children?: React.ReactNode;
  screenshot?: ScreenshotData | null;
  viewOnly?: boolean;
  className?: string;
  status?: VirtualDesktopStatus;
}

export const DesktopContainer: React.FC<DesktopContainerProps> = ({
  children,
  screenshot,
  viewOnly = false,
  className = "",
  status = "running",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isMounted, setIsMounted] = useState(false);

  // Set isMounted to true after component mounts
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate the container size on mount and window resize
  useEffect(() => {
    if (!isMounted) return;

    const updateSize = () => {
      if (!containerRef.current) return;

      const parentWidth =
        containerRef.current.parentElement?.offsetWidth ||
        containerRef.current.offsetWidth;
      const parentHeight =
        containerRef.current.parentElement?.offsetHeight ||
        containerRef.current.offsetHeight;

      // Calculate the maximum size while maintaining 1280:960 aspect ratio
      let width, height;
      const aspectRatio = 1280 / 960;

      if (parentWidth / parentHeight > aspectRatio) {
        // Width is the limiting factor
        height = parentHeight;
        width = height * aspectRatio;
      } else {
        // Height is the limiting factor
        width = parentWidth;
        height = width / aspectRatio;
      }

      // Cap at maximum dimensions
      width = Math.min(width, 1280);
      height = Math.min(height, 960);

      setContainerSize({ width, height });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isMounted]);

  return (
    <div
      className={`flex w-full flex-col rounded-t-lg border border-border bg-muted dark:border-border/60 dark:bg-card ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between rounded-t-lg border-b border-border bg-card px-4 py-2 dark:border-border/60 dark:bg-muted">
        {/* Status Header */}
        <div className="flex items-center gap-2">
          <VirtualDesktopStatusHeader status={status} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">{children}</div>
      </div>

      <div ref={containerRef} className="flex aspect-[4/3] overflow-hidden">
        <div
          style={{
            width: `${containerSize.width}px`,
            height: `${containerSize.height}px`,
            maxWidth: "100%",
          }}
        >
          {screenshot ? (
            <ScreenshotViewer
              screenshot={screenshot}
              className="h-full w-full"
            />
          ) : (
            <VncViewer viewOnly={viewOnly} />
          )}
        </div>
      </div>
    </div>
  );
};
