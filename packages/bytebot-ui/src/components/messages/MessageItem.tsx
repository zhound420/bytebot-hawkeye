import React from "react";
import ReactMarkdown from "react-markdown";
import { Message, MessageRole } from "@/types";
import {
  isImageContentBlock,
  isTextContentBlock,
  isToolResultContentBlock,
  isToolUseContentBlock,
} from "../../../shared/utils/messageContent.utils";
import Image from "next/image";
import { HugeiconsIcon } from '@hugeicons/react'
import { User03Icon } from '@hugeicons/core-free-icons'

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  if (
    message.role === MessageRole.ASSISTANT ||
    isToolResultContentBlock(message.content[0])
  ) {
    return <AssistantMessage message={message} />;
  }

  return <UserMessage message={message} />;
}

function AssistantMessage({ message }: MessageItemProps) {
  // filter content blocks
  let contentBlocks = message.content.filter(
    (block) => !isToolUseContentBlock(block),
  );

  contentBlocks = contentBlocks.map((block) => {
    if (block.content) {
      block.content = block.content.filter((contentBlock) => {
        if (isTextContentBlock(contentBlock)) {
          return contentBlock.text !== "Tool executed successfully";
        }
        return true;
      });
    }
    return block;
  });

  if (contentBlocks.length === 0) {
    return <></>;
  }

  return (
    <div className="mb-4">
      <div className="flex items-start gap-2">
        <div className="border-bytebot-bronze-light-7 flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-sm border bg-white">
          <img
            src="/bytebot_square_light.svg"
            alt="Bytebot"
            className="h-4 w-4"
          />
        </div>
        <div className="w-full">
          {contentBlocks.map((block, index) => (
            <>
              {isTextContentBlock(block) && (
                <div className="text-bytebot-bronze-dark-8 mb-2 text-xs">
                  <ReactMarkdown>{block.text}</ReactMarkdown>
                </div>
              )}
              {isImageContentBlock(block) && (
                <Image
                  key={index}
                  src={block?.source?.data}
                  alt={"image"}
                  width={50}
                  height={50}
                />
              )}
              {isImageContentBlock(block.content?.[0]) && (
                <div className="bg-bytebot-bronze-light-2 shadowshadow-[0px_1px_1px_rgba(0,0,0,0.06)] border-bytebot-bronze-light-7 flex w-full items-center justify-between rounded-sm border px-2 py-1.5">
                  <p className="text-bytebot-bronze-light-11 text-sm">
                    Screenshot
                  </p>
                  <Image
                    key={index}
                    src={`data:${block.content?.[0]?.source?.media_type};${block.content?.[0]?.source?.type},${block.content?.[0]?.source?.data}`}
                    alt={"image"}
                    width={50}
                    height={50}
                  />
                </div>
              )}
              {isToolUseContentBlock(block) && <p>{block.name}</p>}
            </>
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
      !isToolResultContentBlock(block),
  );

  if (contentBlocks.length === 0) {
    return <></>;
  }

  return (
    <div className="mb-4">
      <div className="flex flex-row-reverse items-start gap-2">
        <div className="border-bytebot-bronze-light-7 bg-muted flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-sm border">
          <HugeiconsIcon icon={User03Icon} className="text-bytebot-bronze-dark-9 w-4 h-4" />
        </div>
        <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-7 max-w-4/5 rounded-md border px-3 py-2 shadow-[0px_0px_0px_1.5px_#FFF_inset]">
          {contentBlocks.map((block, index) => (
            <div
              key={index}
              className="text-bytebot-bronze-dark-9 mb-2 text-xs"
            >
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
