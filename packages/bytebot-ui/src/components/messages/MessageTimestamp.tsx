import React from "react";
import { cn } from "@/lib/utils";
import { MessageTimestampMeta } from "@/lib/datetime";

interface MessageTimestampProps {
  timestamp?: MessageTimestampMeta | null;
  className?: string;
  prefix?: string;
}

export function MessageTimestamp({ timestamp, className, prefix }: MessageTimestampProps) {
  if (!timestamp) {
    return null;
  }

  const displayText = prefix ? `${prefix} ${timestamp.formatted}` : timestamp.formatted;
  const ariaLabelPrefix = prefix ?? "Sent at";

  return (
    <time
      className={cn(
        "text-[11px] font-medium tracking-wide text-muted-foreground",
        className,
      )}
      dateTime={timestamp.iso}
      title={timestamp.iso}
      aria-label={`${ariaLabelPrefix} ${timestamp.iso}`}
    >
      {displayText}
    </time>
  );
}
