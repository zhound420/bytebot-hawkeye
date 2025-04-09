"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { VncViewer } from "@/components/vnc/VncViewer";
import { ChatContainer } from "@/components/messages/ChatContainer";
import { ChatInput } from "@/components/messages/ChatInput";
import { DraggableContainer } from "@/components/ui/draggable-container";
import { useChatSession } from "@/hooks/useChatSession";

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

      const parentWidth = window.innerWidth * 0.9; // Use 90% of viewport width
      const parentHeight = window.innerHeight * 0.9; // Use 90% of viewport height

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
      <main className="flex flex-1 items-center justify-center p-4 overflow-hidden">
        {/* Main 16:9 container */}
        <div
          ref={containerRef}
          className="relative bg-muted/30 rounded-lg overflow-hidden"
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
        {/* Only render the draggable container after mounting */}
        {isMounted && containerSize.width > 0 && (
          <DraggableContainer
            title="Chat"
            parentSize={containerSize}
            minWidth={350}
          >
            <div className="flex flex-col h-full">
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
          </DraggableContainer>
        )}
      </main>
    </div>
  );

  // return (
  //   <div className="flex flex-col h-screen">
  //     {/* Header */}
  //     <Header />

  //     {/* Main content */}
  //     <div className="flex flex-1 overflow-hidden">
  //       {/* Left side - VNC client */}
  //       <VncViewer />

  //       {/* Right side - chat */}
  //       <div className="w-2/5 flex flex-col">
  //         <ChatContainer
  //           messages={messages}
  //           isLoadingSession={isLoadingSession}
  //         />
  //         <ChatInput
  //           input={input}
  //           isLoading={isLoading}
  //           onInputChange={setInput}
  //           onSend={handleSend}
  //         />
  //       </div>
  //     </div>
  //   </div>
  // );
}
