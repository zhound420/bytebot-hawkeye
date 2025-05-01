import React, { useRef, useEffect } from "react";
import { Message } from "@/types";
import { MessageItem } from "./MessageItem";

interface ChatContainerProps {
  messages: Message[];
  isLoadingSession: boolean;
}

/**
 * Groups back-to-back messages from the same role in a conversation JSON
 * 
 * @param {Object} conversationJson - The conversation JSON object with messages array
 * @returns {Object} A new conversation object with grouped messages
 */
function groupBackToBackMessages(conversationJson: { messages: Message[] }) {
  const groupedConversation = {
    ...conversationJson,
    messages: [] as Message[]
  };
  
  let currentGroup = null;
  
  for (const message of conversationJson.messages) {
    const role = message.role;
    
    // If this is the first message or role is different from the previous group
    if (!currentGroup || currentGroup.role !== role) {
      // Save the previous group if it exists
      if (currentGroup) {
        groupedConversation.messages.push(currentGroup);
      }
      
      // Start a new group
      currentGroup = {
        id: message.id,
        role: role,
        content: [...message.content],
        createdAt: message.createdAt
      };
    } else {
      // Same role as previous, merge the content
      currentGroup.content = [...currentGroup.content, ...message.content];
      // Keep the original createdAt timestamp
    }
  }
  
  // Add the last group
  if (currentGroup) {
    groupedConversation.messages.push(currentGroup);
  }
  
  return groupedConversation;
}

export function ChatContainer({
  messages,
  isLoadingSession,
}: ChatContainerProps) {
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  
  // Group back-to-back messages from the same role
  const groupedMessages = groupBackToBackMessages({ messages }).messages;

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
        <div className="flex justify-center items-center h-full">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary"></div>
        </div>
      ) : messages.length > 0 ? (
        groupedMessages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))
      ) : (
        <div className="flex justify-center items-center h-full">
          <p className="">No messages yet...</p>
        </div>
      )}
    </div>
  );
}
