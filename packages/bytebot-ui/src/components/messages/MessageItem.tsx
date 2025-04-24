import React from "react";
import { User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Image from "next/image";
import { Message, MessageRole } from "@/types";
import {
  isImageContentBlock,
  isTextContentBlock,
  isToolResultContentBlock,
  isToolUseContentBlock,
} from "../../../shared/utils/messageContent.utils";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  if (message.role === MessageRole.ASSISTANT) {
    return <AssistantMessage message={message} />;
  }

  return <UserMessage message={message} />;
}

function AssistantMessage({ message }: MessageItemProps) {
  // TODO: Handle tool blocks

  // filter content blocks
  const contentBlocks = message.content.filter(
    (block) => !isToolUseContentBlock(block)
  );

  if (contentBlocks.length === 0) {
    return <></>;
  }

  return (
    <div className="mb-4">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <span className="text-primary-foreground text-xs">B</span>
        </div>
        <div className="text-sm">
          <div>
            {contentBlocks.map((block, index) => (
              <div key={index} className="mb-2">
                {isTextContentBlock(block) && (
                  <ReactMarkdown>{block.text}</ReactMarkdown>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserMessage({ message }: MessageItemProps) {
  const contentBlocks = message.content.filter(
    (block) =>
      (isToolResultContentBlock(block) &&
        block.content.filter(isImageContentBlock).length > 0) ||
      !isToolResultContentBlock(block)
  );

  if (contentBlocks.length === 0) {
    return <></>;
  }

  return (
    <div className="mb-4">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          <User className="h-3 w-3" />
        </div>
        <div className="text-sm">
          <div>
            {contentBlocks.map((block, index) => (
              <div key={index} className="mb-2">
                {isTextContentBlock(block) && (
                  <ReactMarkdown>{block.text}</ReactMarkdown>
                )}
                {isToolResultContentBlock(block) &&
                  block.content.map(
                    (contentBlock, contentIndex) =>
                      isImageContentBlock(contentBlock) && (
                        <div key={`${index}-${contentIndex}`} className="my-2">
                          <Image
                            src={`data:${contentBlock.source.media_type};base64,${contentBlock.source.data}`}
                            alt="Image in message"
                            width={500}
                            height={300}
                            className="max-w-full rounded-md object-contain"
                            style={{ maxHeight: "300px" }}
                          />
                        </div>
                      )
                  )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
