"use client";

import React from "react";
import { Header } from "@/components/layout/Header";
import { VncViewer } from "@/components/vnc/VncViewer";
import { ChatContainer } from "@/components/messages/ChatContainer";
import { ChatInput } from "@/components/messages/ChatInput";
import { useChatSession } from "@/hooks/useChatSession";

export default function Home() {
  const {
    messages,
    input,
    setInput,
    isLoading,
    isLoadingSession,
    handleSend,
  } = useChatSession();

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <Header />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left side - VNC client */}
        <VncViewer />

        {/* Right side - chat */}
        <div className="w-2/5 flex flex-col">
          <ChatContainer 
            messages={messages} 
            isLoadingSession={isLoadingSession} 
          />
          <ChatInput 
            input={input}
            isLoading={isLoading}
            onInputChange={setInput}
            onSend={handleSend}
          />
        </div>
      </div>
    </div>
  );
}
