"use client";

import type React from "react";
import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ContainerSize = "full" | "compact" | "minimized";

interface DraggableContainerProps {
  title: string;
  children: React.ReactNode;
  defaultPosition?: { x: number; y: number };
  className?: string;
  onClose?: () => void;
  parentSize: { width: number; height: number };
  minWidth?: number;
}

export function DraggableContainer({
  title,
  children,
  defaultPosition,
  className,
  onClose,
  parentSize,
  minWidth = 300, // Default minimum width of 300px
}: DraggableContainerProps) {
  // Use a safe initial position that doesn't depend on window
  const [position, setPosition] = useState(defaultPosition || { x: 0, y: 0 });
  const [sizeMode, setSizeMode] = useState<ContainerSize>("full");
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const [isMounted, setIsMounted] = useState(false);

  // Set isMounted to true after component mounts
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate container width with minimum constraint
  const getWidth = () => {
    const calculatedWidth = parentSize.width * (1 / 4); // Changed from 1/5 to 1/4
    return Math.max(calculatedWidth, minWidth); // Ensure width is never less than minWidth
  };

  // Calculate and set initial position after component mounts
  useEffect(() => {
    if (isMounted && !defaultPosition) {
      const containerWidth = getWidth();
      const rightPosition = window.innerWidth - containerWidth - 20;
      const centerY = (window.innerHeight - parentSize.height * (7 / 8)) / 2;

      setPosition({
        x: rightPosition,
        y: centerY,
      });
    }
  }, [isMounted, defaultPosition, parentSize, minWidth]);

  // Update position if window size changes
  useEffect(() => {
    if (!isMounted) return;

    const updatePosition = () => {
      // Only update if not manually positioned by user
      if (!isDragging && !defaultPosition) {
        const containerWidth = getWidth();
        setPosition({
          x: window.innerWidth - containerWidth - 20,
          y: (window.innerHeight - parentSize.height * (7 / 8)) / 2,
        });
      }
    };

    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [parentSize, isDragging, isMounted, defaultPosition, minWidth]);

  const getHeight = () => {
    switch (sizeMode) {
      case "full":
        return parentSize.height * (7 / 8);
      case "compact":
        return parentSize.height * (3 / 8);
      case "minimized":
        return "auto";
    }
  };

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  useEffect(() => {
    if (!isMounted) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = e.clientX - dragStartRef.current.x;
        const newY = e.clientY - dragStartRef.current.y;

        // Ensure the container stays within the viewport bounds
        const containerWidth = getWidth();
        const containerHeight =
          typeof getHeight() === "string" ? 40 : (getHeight() as number); // 40px for header height when minimized

        const maxX = window.innerWidth - containerWidth;
        const maxY = window.innerHeight - containerHeight;

        setPosition({
          x: Math.max(0, Math.min(newX, maxX)),
          y: Math.max(0, Math.min(newY, maxY)),
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position, isMounted]);

  // Cycle through size modes
  const cycleSizeMode = () => {
    if (sizeMode === "full") {
      setSizeMode("compact");
    } else if (sizeMode === "compact") {
      setSizeMode("minimized");
    } else {
      setSizeMode("full");
    }
  };

  // Get the appropriate icon for the current size mode
  const getSizeIcon = () => {
    switch (sizeMode) {
      case "full":
        return <ChevronDown className="h-4 w-4" />;
      case "compact":
        return <ChevronDown className="h-4 w-4" />;
      case "minimized":
        return <ChevronUp className="h-4 w-4" />;
    }
  };

  // Don't render anything during SSR
  if (!isMounted) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "fixed shadow-lg rounded-lg border bg-background overflow-hidden",
        className
      )}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${getWidth()}px`,
        height: getHeight(),
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 bg-muted cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={cycleSizeMode}
            className="p-1 rounded-sm hover:bg-muted-foreground/20 transition-colors"
            aria-label="Change size"
          >
            {getSizeIcon()}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-sm hover:bg-muted-foreground/20 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {sizeMode !== "minimized" && (
        <div
          className="flex-1 overflow-auto p-4"
          style={{ height: "calc(100% - 40px)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// Optional View component for organization (not required for basic functionality)
interface ViewProps {
  title: string;
  icon?: React.ReactNode;
  id?: string;
  children: React.ReactNode;
}

export function View({ title, icon, id, children }: ViewProps) {
  return (
    <div id={id} className="border rounded-md p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      {children}
    </div>
  );
}
