import React, { useRef, useEffect, useCallback } from "react";
import { Message, Role, TaskStatus } from "@/types";
import { MessageGroup } from "./MessageGroup";
import { isToolResultContentBlock } from "@bytebot/shared";
import { TextShimmer } from "../ui/text-shimmer";

interface ChatContainerProps {
  taskStatus: TaskStatus;
  control: Role;
  messages: Message[];
  isLoadingSession: boolean;
  isLoadingMoreMessages?: boolean;
  hasMoreMessages?: boolean;
  loadMoreMessages?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export interface GroupedMessages {
  role: Role;
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
      message.role === Role.USER &&
      contentBlocks.every((block) => isToolResultContentBlock(block))
    ) {
      message.role = Role.ASSISTANT;
    }

    filteredMessages.push(message);
  }
  return filteredMessages;
}

export function ChatContainer({
  taskStatus,
  control,
  messages,
  isLoadingSession,
  isLoadingMoreMessages = false,
  hasMoreMessages = false,
  loadMoreMessages,
  scrollRef,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  
  // Group back-to-back messages from the same role
  const groupedConversation = groupBackToBackMessages(filterMessages(messages));

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollRef?.current || !loadMoreMessages) {
      console.log('Scroll handler early return:', {
        hasScrollRef: !!scrollRef?.current,
        hasLoadMoreMessages: !!loadMoreMessages,
        hasMoreMessages,
        isLoadingMoreMessages
      });
      return;
    }

    const container = scrollRef.current;
    // Check if user scrolled to the bottom (within 20px - much more sensitive)
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    console.log('Scroll metrics:', {
      scrollTop,
      scrollHeight,
      clientHeight,
      distanceFromBottom,
      hasMoreMessages,
      isLoadingMoreMessages
    });

    if (distanceFromBottom <= 20 && hasMoreMessages && !isLoadingMoreMessages) {
      console.log('Triggering loadMoreMessages');
      loadMoreMessages();
    }
  }, [scrollRef, loadMoreMessages, hasMoreMessages, isLoadingMoreMessages]);

  // Add scroll event listener
  useEffect(() => {
    const container = scrollRef?.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll, scrollRef]);

  // This effect runs whenever the messages array changes
  useEffect(() => {
    if (
      taskStatus === TaskStatus.RUNNING ||
      taskStatus === TaskStatus.NEEDS_HELP
    ) {
      scrollToBottom();
    }
  }, [taskStatus, messages]);

  // Function to scroll to the bottom of the messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="flex-1 p-4">
      {isLoadingSession ? (
        <div className="flex h-full items-center justify-center">
          <div className="border-t-primary h-8 w-8 animate-spin rounded-full border-4 border-gray-300"></div>
        </div>
      ) : messages.length > 0 ? (
        <>
          {groupedConversation.map((group, groupIndex) => (
            <div key={groupIndex}>
              <MessageGroup group={group} messages={messages} />
            </div>
          ))}
          
          {taskStatus === TaskStatus.RUNNING && control === Role.ASSISTANT && (
            <TextShimmer className="text-sm" duration={2}>
              Bytebot is working...
            </TextShimmer>
          )}
          
          {/* Loading indicator for infinite scroll at bottom */}
          {isLoadingMoreMessages && (
            <div className="flex justify-center py-4">
              <div className="border-t-primary h-6 w-6 animate-spin rounded-full border-2 border-gray-300"></div>
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="">No messages yet...</p>
        </div>
      )}
      {/* This empty div is the target for scrolling */}
      <div ref={messagesEndRef} />
    </div>
  );
}
