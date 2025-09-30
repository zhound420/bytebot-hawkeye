import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerToolUseContentBlock,
  isTypeKeysToolUseBlock,
  isTypeTextToolUseBlock,
  isPressKeysToolUseBlock,
  isWaitToolUseBlock,
  isScrollToolUseBlock,
  isComputerDetectElementsToolUseBlock,
  isComputerClickElementToolUseBlock,
} from "@bytebot/shared";
import { getIcon, getLabel } from "./ComputerToolUtils";
import { MessageTimestampMeta } from "@/lib/datetime";
import { MessageTimestamp } from "../MessageTimestamp";

interface ComputerToolContentTakeOverProps {
  block: ComputerToolUseContentBlock;
  timestamp?: MessageTimestampMeta | null;
}

function ToolDetailsTakeOver({ block }: { block: ComputerToolUseContentBlock }) {
  const baseClasses =
    "rounded-md border border-border bg-muted px-1 py-0.5 text-xs text-primary";

  return (
    <>
      {/* Text for type and key actions */}
      {(isTypeKeysToolUseBlock(block) || isPressKeysToolUseBlock(block)) && (
        <p className={baseClasses}>
          {String(block.input.keys.join("+"))}
        </p>
      )}
      
      {isTypeTextToolUseBlock(block) && (
        <p className={baseClasses}>
          {String(
            block.input.isSensitive
              ? "●".repeat(block.input.text.length)
              : block.input.text,
          )}
        </p>
      )}
      
      {/* Duration for wait actions */}
      {isWaitToolUseBlock(block) && (
        <p className={baseClasses}>
          {`${block.input.duration}ms`}
        </p>
      )}
      
      {/* Coordinates for click/mouse actions */}
      {block.input.coordinates && (
        <p className={baseClasses}>
          {(block.input.coordinates as { x: number; y: number }).x},
          {" "}
          {(block.input.coordinates as { x: number; y: number }).y}
        </p>
      )}
      
      {/* Start and end coordinates for path actions */}
      {"path" in block.input &&
        Array.isArray(block.input.path) &&
        block.input.path.every(
          (point) => point.x !== undefined && point.y !== undefined,
        ) && (
          <p className={baseClasses}>
            From: {block.input.path[0].x}, {block.input.path[0].y} → To:{" "}
            {block.input.path[block.input.path.length - 1].x},{" "}
            {block.input.path[block.input.path.length - 1].y}
          </p>
        )}
      
      {/* Scroll information */}
      {isScrollToolUseBlock(block) && (
        <p className={baseClasses}>
          {String(block.input.direction)} {Number(block.input.scrollCount)}
        </p>
      )}

      {isComputerDetectElementsToolUseBlock(block) && (
        <>
          <p className={baseClasses}>{block.input.description}</p>
          {block.input.includeAll && (
            <p className={baseClasses}>includeAll</p>
          )}
          {block.input.region && (
            <p className={baseClasses}>
              Region: x={block.input.region.x}, y={block.input.region.y}, w=
              {block.input.region.width}, h={block.input.region.height}
            </p>
          )}
        </>
      )}

      {isComputerClickElementToolUseBlock(block) && (
        <>
          <p className={baseClasses}>ID: {block.input.element_id}</p>
          {block.input.fallback_coordinates && (
            <p className={baseClasses}>
              Fallback: {block.input.fallback_coordinates.x},{" "}
              {block.input.fallback_coordinates.y}
            </p>
          )}
        </>
      )}
    </>
  );
}

export function ComputerToolContentTakeOver({
  block,
  timestamp,
}: ComputerToolContentTakeOverProps) {
  // Don't render screenshot tool use blocks here - they're handled separately
  if (getLabel(block) === "Screenshot") {
    return null;
  }

  return (
    <div className="max-w-4/5">
      <div className="flex flex-wrap items-center justify-start gap-2 text-muted-foreground">
        <div className="flex h-7 w-7 items-center justify-center text-primary">
          <HugeiconsIcon
            icon={getIcon(block)}
            className="h-4 w-4"
          />
        </div>
        <p className="text-xs">
          {getLabel(block)}
        </p>
        <MessageTimestamp
          timestamp={timestamp}
          className="text-[10px] normal-case"
          prefix="Action at"
        />
        <ToolDetailsTakeOver block={block} />
      </div>
    </div>
  );
}
