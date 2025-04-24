"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { VncViewer } from "@/components/vnc/VncViewer";
import { ChatContainer } from "@/components/messages/ChatContainer";
import { ChatInput } from "@/components/messages/ChatInput";
import { useChatSession } from "@/hooks/useChatSession";
import { BrowserHeader } from "@/components/layout/BrowserHeader";

export default function Home() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const { messages, input, setInput, isLoading, isLoadingSession, handleSend } =
    useChatSession();

  const [isMounted, setIsMounted] = useState(false);

  // Set isMounted to true after component mounts
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Calculate the container size on mount and window resize
  useEffect(() => {
    if (!isMounted) return;

    const updateSize = () => {
      if (!containerRef.current) return;

      const parentWidth = window.innerWidth * 0.5; // Use 50% of viewport width
      const parentHeight = window.innerHeight * 0.5; // Use 50% of viewport height

      // Calculate the maximum size while maintaining 1280:720 aspect ratio
      let width, height;
      const aspectRatio = 1280 / 720;

      if (parentWidth / parentHeight > aspectRatio) {
        // Width is the limiting factor
        height = parentHeight;
        width = height * aspectRatio;
      } else {
        // Height is the limiting factor
        width = parentWidth;
        height = width / aspectRatio;
      }

      // Cap at maximum dimensions
      width = Math.min(width, 1280);
      height = Math.min(height, 720);

      setContainerSize({ width, height });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isMounted]);

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <Header />
      <main className="p-0.5 bg-white rounded-2xl border-1 border-bytebot-bronze-light-7 m-2">
        <div className="rounded-2xl bg-bronze-light-4">
          <div className="bg-bytebot-bronze-light-4 p-2 rounded-2xl">
            <div className="flex flex-1 items-start justify-center">
              <div className="bg-white rounded-2xl border-1 border-bytebot-bronze-light-7 p-0.5 w-full">
                <div className="">
                  {/* Main 16:9 container */}
                  <BrowserHeader />
                  <div className="bg-white w-full h-0.75 border-b border-bytebot-bronze-light-7"></div>
                  <div
                    ref={containerRef}
                    className="relative overflow-hidden rounded-b-2xl"
                    style={{
                      width: `${containerSize.width}px`,
                      height: `${containerSize.height}px`,
                    }}
                  >
                    {/* Content for the main container would go here */}
                    <div className="flex items-center justify-center h-full">
                      <VncViewer />
                    </div>
                  </div>
                </div>
              </div>
              {/* Chat Area */}
              <div className="flex flex-col h-[80vh] max-h-[80vh] ml-4">
                {/* Messages scrollable area */}
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 min-h-0">
                  <ChatContainer messages={messages} isLoadingSession={isLoadingSession} />
                </div>
                {/* Fixed chat input */}
                <div className="px-4 py-3 bg-bytebot-bronze-light-2 rounded-2xl">
                  <ChatInput
                    input={input}
                    isLoading={isLoading}
                    onInputChange={setInput}
                    onSend={handleSend}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
