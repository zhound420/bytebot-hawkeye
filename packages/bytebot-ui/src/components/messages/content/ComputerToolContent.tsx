import React from "react";
import { ComputerToolUseContentBlock } from "@bytebot/shared";
import { ComputerToolContentTakeOver } from "./ComputerToolContentTakeOver";
import { ComputerToolContentNormal } from "./ComputerToolContentNormal";
import { MessageTimestampMeta } from "@/lib/datetime";

interface ComputerToolContentProps {
  block: ComputerToolUseContentBlock;
  isTakeOver?: boolean;
  timestamp?: MessageTimestampMeta | null;
}

export function ComputerToolContent({
  block,
  isTakeOver = false,
  timestamp,
}: ComputerToolContentProps) {
  if (isTakeOver) {
    return <ComputerToolContentTakeOver block={block} timestamp={timestamp} />;
  }

  return <ComputerToolContentNormal block={block} timestamp={timestamp} />;
}