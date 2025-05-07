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

// Define the IconType for proper type checking
type IconType = typeof Camera01Icon | typeof User03Icon | typeof Cursor02Icon | 
               typeof TypeCursorIcon | typeof MouseRightClick06Icon | typeof TimeQuarter02Icon

interface MessageItemProps {
  message: Message;
}

function getIcon(type: string): IconType {
  const iconLookup: Record<string, IconType> = {
    'screenshot': Camera01Icon,
    'left_click': Cursor02Icon,
    'right_click': MouseRightClick06Icon,
    'double_click': Cursor02Icon,
    'triple_click': Cursor02Icon,
    'middle_click': Cursor02Icon,
    'mouse_move': Cursor02Icon,
    'left_mouse_down': Cursor02Icon,
    'left_mouse_up': Cursor02Icon,
    'left_click_drag': Cursor02Icon,
    'scroll': Cursor02Icon,
    'type': TypeCursorIcon,
    'key': MouseRightClick06Icon,
    'hold_key': MouseRightClick06Icon,
    'wait': TimeQuarter02Icon,
    'cursor_position': Cursor02Icon
  };
  return iconLookup[type] || User03Icon;
}

function getLabel(type: string) {
  const labelLookup: Record<string, string> = {
    'screenshot': 'Screenshot',
    'left_click': 'Left Click',
    'right_click': 'Right Click',
    'double_click': 'Double Click',
    'triple_click': 'Triple Click',
    'middle_click': 'Middle Click',
    'mouse_move': 'Mouse Move',
    'left_mouse_down': 'Mouse Down',
    'left_mouse_up': 'Mouse Up',
    'left_click_drag': 'Drag',
    'scroll': 'Scroll',
    'type': 'Type',
    'key': 'Key',
    'hold_key': 'Hold Key',
    'wait': 'Wait',
    'cursor_position': 'Cursor Position'
  };
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
        <div className="w-full space-y-2">
          {contentBlocks
            .map((block) => (
              <>
                {isTextContentBlock(block) && (
                  <div className="text-bytebot-bronze-dark-8 text-xs">
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
                      {/* Text for type and key actions */}
                      {(block.input.action === 'type' || block.input.action === 'key' || block.input.action === 'hold_key') && 'text' in block.input && (
                        <p className="rounded-md bg-bytebot-bronze-light-1 py-0.5 px-1 text-xs border-bytebot-bronze-light-7 border text-bytebot-bronze-light-11">{String(block.input.text)}</p>
                      )}
                      {/* Duration for wait and hold_key actions */}
                      {(block.input.action === 'wait' || block.input.action === 'hold_key') && 'duration' in block.input && (
                        <p className="rounded-md bg-bytebot-bronze-light-1 py-0.5 px-1 text-xs border-bytebot-bronze-light-7 border text-bytebot-bronze-light-11">{Number(block.input.duration)}ms</p>
                      )}
                      {/* Coordinates for click/mouse actions */}
                      {(['left_click', 'right_click', 'middle_click', 'double_click', 'triple_click', 'mouse_move', 'scroll'].includes(block.input.action as string)) && 'coordinate' in block.input && Array.isArray(block.input.coordinate) && (
                        <p className="rounded-md bg-bytebot-bronze-light-1 py-0.5 px-1 text-xs border-bytebot-bronze-light-7 border text-bytebot-bronze-light-11">{block.input.coordinate[0]}, {block.input.coordinate[1]}</p>
                      )}
                      {/* Start and end coordinates for drag actions */}
                      {block.input.action === 'left_click_drag' && 'start_coordinate' in block.input && 'coordinate' in block.input && 
                       Array.isArray(block.input.start_coordinate) && Array.isArray(block.input.coordinate) && (
                        <p className="rounded-md bg-bytebot-bronze-light-1 py-0.5 px-1 text-xs border-bytebot-bronze-light-7 border text-bytebot-bronze-light-11">
                          From: {block.input.start_coordinate[0]}, {block.input.start_coordinate[1]} → 
                          To: {block.input.coordinate[0]}, {block.input.coordinate[1]}
                        </p>
                      )}
                      {/* Scroll information */}
                      {block.input.action === 'scroll' && 'scroll_amount' in block.input && 'scroll_direction' in block.input && (
                        <p className="rounded-md bg-bytebot-bronze-light-1 py-0.5 px-1 text-xs border-bytebot-bronze-light-7 border text-bytebot-bronze-light-11">
                          {String(block.input.scroll_direction)} {Number(block.input.scroll_amount)}
                        </p>
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
        <div className="bg-bytebot-bronze-light-2 space-y-2 border-bytebot-bronze-light-7 max-w-4/5 rounded-md border px-3 py-2 shadow-bytebot">
          {contentBlocks.map((block, index) => (
            <div
              key={index}
              className="text-bytebot-bronze-dark-9 text-xs"
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
