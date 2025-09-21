import React from "react";
import { GroupedMessages, TaskStatus } from "@/types";
import { MessageAvatar } from "./MessageAvatar";
import { MessageContent } from "./content/MessageContent";
import { isToolResultContentBlock, isImageContentBlock } from "@bytebot/shared";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getMessageTimestampMeta } from "@/lib/datetime";
import { MessageTimestamp } from "./MessageTimestamp";

interface AssistantMessageProps {
  group: GroupedMessages;
  taskStatus: TaskStatus;
  messageIdToIndex: Record<string, number>;
}

export function AssistantMessage({
  group,
  taskStatus,
  messageIdToIndex,
}: AssistantMessageProps) {
  return (
    <div
      className={
        cn(
          "flex items-start justify-start gap-2 border-x border-border bg-card px-4 py-3 text-card-foreground",
          ![TaskStatus.RUNNING, TaskStatus.NEEDS_HELP].includes(taskStatus) &&
            !group.take_over &&
            "border-b border-border rounded-b-lg"
        )
      }
    >
      <MessageAvatar role={group.role} />

      {group.take_over ? (
        <div className="w-full rounded-2xl border border-border bg-card p-2">
          <div className="flex items-center gap-2">
            <Image
              src="/indicators/indicator-pink.png"
              alt="User control status"
              width={15}
              height={15}
            />
            <p className="text-[12px] font-medium text-card-foreground">
              You took control
            </p>
          </div>
          <div className="mt-2 space-y-0.5 rounded-2xl border border-border/60 bg-muted/60 p-1">
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
                      className="block text-[10px] text-muted-foreground"
                      prefix="Action at"
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
                  <MessageContent
                    content={message.content}
                    isTakeOver={message.take_over}
                    timestamp={timestamp}
                    showInlineTimestamp={!shouldShowTimestamp}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
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
                    className="block text-muted-foreground"
                    prefix="Action at"
                  />
                )}
                {/* Render hidden divs for each screenshot block */}
                {message.content.map((block, blockIndex) => {
                  if (
                    isToolResultContentBlock(block) &&
                    !block.is_error &&
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
                <MessageContent
                  content={message.content}
                  isTakeOver={message.take_over}
                  timestamp={timestamp}
                  showInlineTimestamp={!shouldShowTimestamp}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
