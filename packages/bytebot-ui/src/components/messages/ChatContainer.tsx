import React, { useRef, useEffect } from "react";
import { Message, MessageRole } from "@/types";
import { MessageGroup } from "./MessageGroup";
import { isToolResultContentBlock } from "../../../shared/utils/messageContent.utils";

interface ChatContainerProps {
  messages: Message[];
  isLoadingSession: boolean;
}

export interface GroupedMessages {
  role: MessageRole;
  messages: Message[];
}

/**
 * Groups back-to-back messages from the same role in a conversation JSON
 *
 * @param {Object} conversation - The conversation JSON object with messages array
 * @returns {Object} A new conversation object with grouped messages
 */
function groupBackToBackMessages(messages: Message[]): GroupedMessages[] {
  const groupedConversation: GroupedMessages[] = [];

  let currentGroup: GroupedMessages | null = null;

  for (const message of messages) {
    const role = message.role;

    // If this is the first message or role is different from the previous group
    if (!currentGroup || currentGroup.role !== role) {
      // Save the previous group if it exists
      if (currentGroup) {
        groupedConversation.push(currentGroup);
      }

      // Start a new group
      currentGroup = {
        role: role,
        messages: [message],
      };
    } else {
      // Same role as previous, merge the content
      currentGroup.messages.push(message);
    }
  }

  // Add the last group
  if (currentGroup) {
    groupedConversation.push(currentGroup);
  }

  return groupedConversation;
}

function filterMessages(messages: Message[]): Message[] {
  const filteredMessages: Message[] = [];
  for (const message of messages) {
    const contentBlocks = message.content;

    // If the role is a user message and all the content blocks are tool result blocks
    if (
      message.role === MessageRole.USER &&
      contentBlocks.every((block) => isToolResultContentBlock(block))
    ) {
      message.role = MessageRole.ASSISTANT;
    }

    filteredMessages.push(message);
  }
  return filteredMessages;
}

export function ChatContainer({
  messages,
  isLoadingSession,
}: ChatContainerProps) {
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Group back-to-back messages from the same role
  const groupedConversation = groupBackToBackMessages(filterMessages(messages));

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={chatContainerRef} className="flex-1 overflow-auto p-4">
      {isLoadingSession ? (
        <div className="flex h-full items-center justify-center">
          <div className="border-t-primary h-8 w-8 animate-spin rounded-full border-4 border-gray-300"></div>
        </div>
      ) : messages.length > 0 ? (
        groupedConversation.map((group, index) => (
          <MessageGroup key={index} group={group} />
        ))
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="">No messages yet...</p>
        </div>
      )}
    </div>
  );
}
