import React, { useRef, useEffect } from 'react';
import { Message } from '@/types';
import { MessageItem } from './MessageItem';

interface ChatContainerProps {
  messages: Message[];
  isLoadingSession: boolean;
}

export function ChatContainer({ messages, isLoadingSession }: ChatContainerProps) {
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div ref={chatContainerRef} className="flex-1 overflow-auto p-4">
      {isLoadingSession ? (
        <div className="flex justify-center items-center h-full">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary"></div>
        </div>
      ) : messages.length > 0 ? (
        messages.map((message) => (
          <div key={message.id} className="mb-4">
            <MessageItem message={message} />
          </div>
        ))
      ) : (
        <div className="flex justify-center items-center h-full">
          <p className="text-muted">No messages yet...</p>
        </div>
      )}
    </div>
  );
}
