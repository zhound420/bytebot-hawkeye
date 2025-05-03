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
import { Camera01Icon, User03Icon, Cursor02Icon, TypeCursorIcon, MouseRightClick06Icon, TimeQuarter02Icon } from '@hugeicons/core-free-icons'

interface MessageItemProps {
  message: Message;
}

function getIcon(type: 'screenshot' | 'left_click' | 'right_click' | 'move' | 'type' | 'key' | 'wait') {
  const iconLookup = {
    'screenshot': Camera01Icon,
    'left_click': Cursor02Icon,
    'right_click': Cursor02Icon,
    'double_click': Cursor02Icon,
    'move': Cursor02Icon,
    'type': TypeCursorIcon,
    'key': MouseRightClick06Icon,
    'wait': TimeQuarter02Icon,
  }
  return iconLookup[type] || User03Icon;
}

function getLabel(type: 'screenshot' | 'left_click' | 'right_click' | 'move' | 'type' | 'key' | 'wait') {
  const labelLookup = {
    'screenshot': 'Screenshot',
    'left_click': 'Left Click',
    'right_click': 'Right Click',
    'double_click': 'Double Click',
    'move': 'Move',
    'type': 'Type',
    'key': 'Key',
    'wait': 'Wait',
  }
  return labelLookup[type] || type;
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
  const contentBlocks = message.content;
  if (contentBlocks.length === 0 || contentBlocks.every((block) => block.content?.length === 0)) {
    return <></>;
  }

  return (
    <div className="mb-4">
      <div className="flex items-start gap-2">
        <div className="border-bytebot-bronze-light-7 flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-sm border bg-white">
          <Image
            src="/bytebot_square_light.svg"
            alt="Bytebot"
            width={16}
            height={16}
            className="h-4 w-4"
          />
        </div>
        <div className="w-full">
          {contentBlocks
            .map((block) => (
              <>
                {isTextContentBlock(block) && (
                  <div className="text-bytebot-bronze-dark-8 mb-2 text-xs">
                    <ReactMarkdown>{block.text}</ReactMarkdown>
                  </div>
                )}

                {isImageContentBlock(block.content?.[0]) && (
                  <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-7 max-w-4/5 rounded-md border px-3 py-2 shadow-bytebot">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={getIcon('screenshot')} className="text-bytebot-bronze-dark-9 w-4 h-4" />
                      <p className="text-bytebot-bronze-light-11 text-xs">
                        {getLabel('screenshot')} taken
                      </p>
                    </div>
                  </div>
                )}

                {isToolUseContentBlock(block) && (
                  <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-7 max-w-4/5 rounded-md border px-3 py-2 shadow-bytebot">
                    <div className="flex items-center gap-2">
                      <HugeiconsIcon icon={getIcon(block.input.action as string)} className="text-bytebot-bronze-dark-9 w-4 h-4" />
                      <p className="text-bytebot-bronze-light-11 text-xs">{getLabel(block.input.action as string)}</p>
                      {block.input.action === 'type' && (
                        <p className="rounded-md bg-bytebot-bronze-light-1 py-0.5 px-1 text-xs border-bytebot-bronze-light-7 border text-bytebot-bronze-light-11">{block.input.text as string}</p>
                      )}
                      {(block.input.action === 'left_click' || block.input.action === 'right_click') && (
                        <p className="rounded-md bg-bytebot-bronze-light-1 py-0.5 px-1 text-xs border-bytebot-bronze-light-7 border text-bytebot-bronze-light-11">{(block.input.coordinate as number[])[0]}, {(block.input.coordinate as number[])[1]}</p>
                      )}
                      {block.input.action === 'key' && (
                        <p className="rounded-md bg-bytebot-bronze-light-1 py-0.5 px-1 text-xs border-bytebot-bronze-light-7 border text-bytebot-bronze-light-11">{block.input.text as string}</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )
          )}
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
        <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-7 max-w-4/5 rounded-md border px-3 py-2 shadow-bytebot">
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
