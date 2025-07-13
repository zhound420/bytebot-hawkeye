import React from "react";
import ReactMarkdown from "react-markdown";
import { GroupedMessages } from "@/types";
import { MessageAvatar } from "./MessageAvatar";
import { isTextContentBlock, isToolResultContentBlock, isImageContentBlock } from "@bytebot/shared";

interface UserMessageProps {
  group: GroupedMessages;
  messageIdToIndex: Record<string, number>;
}

export function UserMessage({ group, messageIdToIndex }: UserMessageProps) {
  return (
    <div className="mb-4 flex items-start justify-start gap-2 px-4 py-3">
      <MessageAvatar role={group.role} />
      
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
            <div className="max-w-4/5 space-y-2 bg-bytebot-bronze-light-4 rounded-md px-2 py-1">
              {message.content.map((block, index) => (
                <div key={index} className="text-bytebot-bronze-light-12 text-xs">
                  {isTextContentBlock(block) && (
                    <ReactMarkdown>{block.text}</ReactMarkdown>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}