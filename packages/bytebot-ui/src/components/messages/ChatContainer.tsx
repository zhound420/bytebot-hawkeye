import React, { useRef, useEffect, useCallback } from "react";
import { Role, TaskStatus, GroupedMessages } from "@/types";
import { MessageGroup } from "./MessageGroup";
import { TextShimmer } from "../ui/text-shimmer";
import { MessageAvatar } from "./MessageAvatar";
import { Loader } from "../ui/loader";

interface ChatContainerProps {
  taskStatus: TaskStatus;
  control: Role;
  groupedMessages: GroupedMessages[];
  isLoadingSession: boolean;
  isLoadingMoreMessages?: boolean;
  hasMoreMessages?: boolean;
  loadMoreMessages?: () => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  messageIdToIndex: Record<string, number>;
}


export function ChatContainer({
  taskStatus,
  control,
  groupedMessages,
  isLoadingSession,
  isLoadingMoreMessages = false,
  hasMoreMessages = false,
  loadMoreMessages,
  scrollRef,
  messageIdToIndex,
}: ChatContainerProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Infinite scroll handler
  const handleScroll = useCallback(() => {
    if (!scrollRef?.current || !loadMoreMessages) {
      return;
    }

    const container = scrollRef.current;
    // Check if user scrolled to the bottom (within 20px - much more sensitive)
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceFromBottom <= 20 && hasMoreMessages && !isLoadingMoreMessages) {
      loadMoreMessages();
    }
  }, [scrollRef, loadMoreMessages, hasMoreMessages, isLoadingMoreMessages]);

  // Add scroll event listener
  useEffect(() => {
    const container = scrollRef?.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll, scrollRef]);

  // This effect runs whenever the grouped messages array changes
  useEffect(() => {
    if (
      taskStatus === TaskStatus.RUNNING ||
      taskStatus === TaskStatus.NEEDS_HELP
    ) {
      scrollToBottom();
    }
  }, [taskStatus, groupedMessages]);

  // Function to scroll to the bottom of the messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="h-full bg-bytebot-bronze-light-2 border border-bytebot-bronze-light-7 rounded-lg">
      {isLoadingSession ? (
        <div className="flex h-full items-center justify-center">
          <Loader size={32} />
        </div>
      ) : groupedMessages.length > 0 ? (
        <>
          {groupedMessages.map((group, groupIndex) => (
            <div key={groupIndex}>
              <MessageGroup group={group} messageIdToIndex={messageIdToIndex} />
            </div>
          ))}

          {taskStatus === TaskStatus.RUNNING && control === Role.ASSISTANT && (
            <div className="flex items-center justify-start gap-4 px-4 py-3">
              <MessageAvatar role={Role.ASSISTANT} />
              <div className="flex items-center justify-start gap-2">
                <div className="flex h-full items-center justify-center py-2">
                  <Loader size={20} />
                </div>
                <TextShimmer className="text-sm" duration={2}>
                  Bytebot is working...
                </TextShimmer>
              </div>
            </div>
          )}

          {/* Loading indicator for infinite scroll at bottom */}
          {isLoadingMoreMessages && (
            <div className="flex justify-center py-4">
              <Loader size={24} />
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
