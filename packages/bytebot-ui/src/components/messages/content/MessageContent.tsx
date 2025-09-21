import React from "react";
import {
  MessageContentBlock,
  isTextContentBlock,
  isImageContentBlock,
  isComputerToolUseContentBlock,
  isToolResultContentBlock,
} from "@bytebot/shared";
import { MessageTimestampMeta } from "@/lib/datetime";
import { TextContent } from "./TextContent";
import { ImageContent } from "./ImageContent";
import { ComputerToolContent } from "./ComputerToolContent";
import { ErrorContent } from "./ErrorContent";

interface MessageContentProps {
  content: MessageContentBlock[];
  isTakeOver?: boolean;
  timestamp?: MessageTimestampMeta | null;
  showInlineTimestamp?: boolean;
}

export function MessageContent({
  content,
  isTakeOver = false,
  timestamp,
  showInlineTimestamp = false,
}: MessageContentProps) {
  // Filter content blocks and check if any visible content remains
  const visibleBlocks = content.filter((block) => {
    // Filter logic from the original code
    if (
      isToolResultContentBlock(block) &&
      block.content &&
      block.content.some((contentBlock) => isImageContentBlock(contentBlock))
    ) {
      return true;
    }
    if (
      isToolResultContentBlock(block) &&
      block.tool_use_id !== "set_task_status" &&
      !block.is_error
    ) {
      return false;
    }
    return true;
  });

  // Skip rendering if no visible content
  if (visibleBlocks.length === 0) {
    return null;
  }

  let inlineTimestampMeta = showInlineTimestamp ? timestamp : null;

  return (
    <div className="w-full">
      {visibleBlocks.map((block, index) => {
        const shouldAttachInlineTimestamp =
          !!inlineTimestampMeta && isComputerToolUseContentBlock(block);
        const timestampForBlock = shouldAttachInlineTimestamp
          ? inlineTimestampMeta
          : null;

        if (shouldAttachInlineTimestamp) {
          inlineTimestampMeta = null;
        }

        return (
          <div key={index}>
            {isTextContentBlock(block) && <TextContent block={block} />}

            {isToolResultContentBlock(block) &&
              !block.is_error &&
              block.content.map((contentBlock, contentBlockIndex) => {
                if (isImageContentBlock(contentBlock)) {
                  return (
                    <ImageContent key={contentBlockIndex} block={contentBlock} />
                  );
                }
                return null;
              })}

            {isComputerToolUseContentBlock(block) && (
              <ComputerToolContent
                block={block}
                isTakeOver={isTakeOver}
                timestamp={timestampForBlock}
              />
            )}

            {isToolResultContentBlock(block) && block.is_error && (
              <ErrorContent block={block} />
            )}

            {isToolResultContentBlock(block) &&
              !block.is_error &&
              block.tool_use_id === "set_task_status" &&
              block.content?.[0].type === "text" && (
                <TextContent block={block.content?.[0]} />
              )}
          </div>
        );
      })}
    </div>
  );
}
