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

      const parentWidth = containerRef.current.offsetWidth;
      const parentHeight = containerRef.current.offsetHeight;

      // Calculate the maximum size while maintaining 1280:960 aspect ratio
      let width, height;
      const aspectRatio = 1280 / 960;

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
      height = Math.min(height, 960);

      setContainerSize({ width, height });
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [isMounted]);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <Header />
      <main className="flex-1 p-0.5 m-2 overflow-hidden">
            <div className="grid grid-cols-6 gap-4 h-full">
              {/* Main container */}
              
              <div className="col-span-4 ">
                <div className="bg-white w-full rounded-2xl border-1 border-bytebot-bronze-light-7 h-full p-3 flex flex-col">
                  <BrowserHeader />
                  <div 
                    className="relative overflow-hidden rounded-b-2xl flex-1 flex justify-center items-center"
                  >
                    <div 
                      ref={containerRef}
                      className="w-full h-full flex justify-center items-center"
                    >
                      <div 
                        style={{
                          width: `${containerSize.width}px`,
                          height: `${containerSize.height}px`,
                          maxWidth: '100%'
                        }}
                      >
                        <VncViewer />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Chat Area */}
              <div className="col-span-2 flex flex-col h-full">
                {/* Messages scrollable area */}
                <div className="flex flex-1 overflow-y-auto px-4 pt-4 pb-2">
                  <ChatContainer messages={messages} isLoadingSession={isLoadingSession} />
                </div>
                {/* Fixed chat input */}
                <div className="p-3 bg-white rounded-2xl border-1 border-bytebot-bronze-light-7">
                  <ChatInput
                    input={input}
                    isLoading={isLoading}
                    onInputChange={setInput}
                    onSend={handleSend}
                  />
                </div>
              </div>
            </div>
      </main>
    </div>
  );
}
