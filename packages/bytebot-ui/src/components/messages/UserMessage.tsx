import React from "react";
import ReactMarkdown from "react-markdown";
import { GroupedMessages } from "@/types";
import { MessageAvatar } from "./MessageAvatar";
import {
  isTextContentBlock,
  isToolResultContentBlock,
  isImageContentBlock,
} from "@bytebot/shared";
import { getMessageTimestampMeta } from "@/lib/datetime";
import { MessageTimestamp } from "./MessageTimestamp";

interface UserMessageProps {
  group: GroupedMessages;
  messageIdToIndex: Record<string, number>;
}

export function UserMessage({ group, messageIdToIndex }: UserMessageProps) {
  return (
    <div className="flex items-start justify-end gap-2 border-x border-border bg-card px-4 py-3 text-card-foreground">
      <div className="space-y-2">
        {group.messages.map((message, index) => {
          const timestamp = getMessageTimestampMeta(message.createdAt);
          const previousTimestamp =
            index > 0
              ? getMessageTimestampMeta(group.messages[index - 1].createdAt)
              : null;
          const shouldShowTimestamp =
            !!timestamp && (!previousTimestamp || previousTimestamp.iso !== timestamp.iso);

          return (
            <div
              key={message.id}
              data-message-index={messageIdToIndex[message.id]}
              className="space-y-1"
            >
              {shouldShowTimestamp && (
                <MessageTimestamp
                  timestamp={timestamp}
                  className="block text-right text-muted-foreground"
                  prefix="Message sent at"
                />
              )}
              {/* Render hidden divs for each screenshot block */}
              {message.content.map((block, blockIndex) => {
                if (
                  isToolResultContentBlock(block) &&
                  block.content &&
                  block.content.length > 0
                ) {
                  // Check ALL content items in the tool result, not just the first one
                  const markers: React.ReactNode[] = [];
                  block.content.forEach((contentItem, contentIndex) => {
                    if (isImageContentBlock(contentItem)) {
                      markers.push(
                        <div
                          key={`${blockIndex}-${contentIndex}`}
                          data-message-index={messageIdToIndex[message.id]}
                          data-block-index={blockIndex}
                          data-content-index={contentIndex}
                          style={{
                            position: "absolute",
                            width: 0,
                            height: 0,
                            overflow: "hidden",
                          }}
                        />
                      );
                    }
                  });
                  return markers;
                }
                return null;
              })}
              <div className="space-y-2 rounded-md bg-muted/60 p-2 text-card-foreground">
                {message.content.map((block, index) => (
                  <div key={index} className="prose prose-sm max-w-none text-sm text-card-foreground">
                    {isTextContentBlock(block) && (
                      <ReactMarkdown>{block.text}</ReactMarkdown>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <MessageAvatar role={group.role} />
    </div>
  );
}
