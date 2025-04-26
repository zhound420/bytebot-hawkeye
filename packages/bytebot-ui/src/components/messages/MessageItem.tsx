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
  if (message.role === MessageRole.ASSISTANT || isToolResultContentBlock(message.content[0])) {
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

  console.log(contentBlocks)

  return (
    <div className="mb-4">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 w-[28px] h-[28px] bg-white rounded-sm flex items-center justify-center border border-bytebot-bronze-light-7">
          <img src="/bytebot_square_light.svg" alt="Bytebot" className="w-4 h-4" />
        </div>
        <div>
          {contentBlocks.map((block, index) => (
            <div key={index} className="mb-2 text-xs text-bytebot-bronze-dark-8">
              {isTextContentBlock(block) && (
                <ReactMarkdown>{block.text}</ReactMarkdown>
              )}
              {isToolResultContentBlock(block) &&
                block.content.map(
                  (contentBlock, contentIndex) => (
                    <p key={contentIndex}>
                      {contentBlock.text}
                    </p>
                  )
                )}
            </div>
          ))}
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
      <div className="flex flex-row-reverse items-start gap-2">
        <div className="flex-shrink-0 w-6 h-6 rounded-sm border border-bytebot-bronze-light-7 bg-muted flex items-center justify-center">
          <User className="h-3 w-3" />
        </div>
        <div className="bg-bytebot-bronze-light-2 border border-bytebot-bronze-light-7 rounded-md py-2 px-3 shadow-[0px_0px_0px_1.5px_#FFF_inset] max-w-4/5">
          {contentBlocks.map((block, index) => (
            <div key={index} className="mb-2 text-xs text-bytebot-bronze-dark-9">
              {isTextContentBlock(block) && (
                <ReactMarkdown>{block.text}</ReactMarkdown>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
