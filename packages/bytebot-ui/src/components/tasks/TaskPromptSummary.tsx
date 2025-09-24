import React, { useState } from "react";
import { TextContentBlock } from "@bytebot/shared";
import { Button } from "@/components/ui/button";
import { TextContent } from "@/components/messages/content/TextContent";
import { cn } from "@/lib/utils";

interface TaskPromptSummaryProps {
  textBlocks: TextContentBlock[];
}

export function TaskPromptSummary({ textBlocks }: TaskPromptSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!textBlocks || textBlocks.length === 0) {
    return null;
  }

  const toggleExpanded = () => setIsExpanded((prev) => !prev);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Task Prompt
          </p>
          {!isExpanded && (
            <p className="text-xs text-muted-foreground">
              Expand to view the full prompt
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          aria-controls="task-prompt-summary-content"
        >
          {isExpanded ? "Collapse" : "Expand"}
        </Button>
      </div>

      <div
        id="task-prompt-summary-content"
        className={cn(
          "space-y-1 px-4 py-3 text-sm text-card-foreground",
          isExpanded ? "max-h-60 overflow-y-auto" : "max-h-24 overflow-hidden",
        )}
      >
        {textBlocks.map((block, index) => (
          <TextContent key={index} block={block} />
        ))}
      </div>
    </div>
  );
}
