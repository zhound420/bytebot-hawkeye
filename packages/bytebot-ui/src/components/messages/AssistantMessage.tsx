import React from "react";
import { GroupedMessages } from "@/types";
import { MessageAvatar } from "./MessageAvatar";
import { MessageContent } from "./content/MessageContent";
import { isToolResultContentBlock, isImageContentBlock } from "@bytebot/shared";

interface AssistantMessageProps {
  group: GroupedMessages;
  messageIdToIndex: Record<string, number>;
}

export function AssistantMessage({ group, messageIdToIndex }: AssistantMessageProps) {
  return (
    <div className="flex items-start justify-start gap-2 px-4 py-3">
      <MessageAvatar role={group.role} />

      {group.take_over ? (
        <div className="border border-bytebot-bronze-light-a6 bg-bytebot-bronze-light-a1 rounded-2xl w-full p-2">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2 ml-1">
              <span className="absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-75"></span>
              <span className="relative inline-flex size-2 rounded-full bg-fuchsia-500"></span>
            </span>
            <p className="text-bytebot-bronze-light-12 text-[12px] font-medium">You took control</p>
          </div>
          <div className="shadow-bytebot rounded-2xl p-1 bg-bytebot-bronze-light-2 mt-2 space-y-0.5">
            {group.messages.map((message) => (
              <div key={message.id} data-message-index={messageIdToIndex[message.id]}>
                {/* Render hidden divs for each screenshot block */}
                {message.content.map((block, blockIndex) => {
                  if (isToolResultContentBlock(block) && block.content && block.content.length > 0) {
                    const imageBlock = block.content[0];
                    if (isImageContentBlock(imageBlock)) {
                      return (
                        <div
                          key={blockIndex}
                          data-message-index={messageIdToIndex[message.id]}
                          data-block-index={blockIndex}
                          style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
                        />
                      );
                    }
                  }
                  return null;
                })}
                <MessageContent 
                  content={message.content} 
                  isTakeOver={message.take_over}
                />
              </div>
            ))}
            </div>
        </div>
      ) : (
        <div>
          {group.messages.map((message) => (
            <div key={message.id} data-message-index={messageIdToIndex[message.id]}>
              {/* Render hidden divs for each screenshot block */}
              {message.content.map((block, blockIndex) => {
                if (isToolResultContentBlock(block) && block.content && block.content.length > 0) {
                  const imageBlock = block.content[0];
                  if (isImageContentBlock(imageBlock)) {
                    return (
                      <div
                        key={blockIndex}
                        data-message-index={messageIdToIndex[message.id]}
                        data-block-index={blockIndex}
                        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}
                      />
                    );
                  }
                }
                return null;
              })}
              <MessageContent 
                content={message.content} 
                isTakeOver={message.take_over}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}