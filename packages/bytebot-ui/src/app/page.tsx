"use client";

import React, { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { VncViewer } from "@/components/vnc/VncViewer";
import { ChatContainer } from "@/components/messages/ChatContainer";
import { ChatInput } from "@/components/messages/ChatInput";
import { useChatSession } from "@/hooks/useChatSession";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// import { BrowserHeader } from "@/components/layout/BrowserHeader";

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

      const parentWidth = containerRef.current.parentElement?.offsetWidth || containerRef.current.offsetWidth;
      const parentHeight = containerRef.current.parentElement?.offsetHeight || containerRef.current.offsetHeight;

      console.log('parentWidth', parentWidth);
      console.log('parentHeight', parentHeight);

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
      <Header />

      <main className="flex-1 px-2 py-4 m-2 overflow-hidden">
        <div className="grid grid-cols-7 gap-4 h-full">

          {/* Main container */}
          <div className="col-span-4">
            <div className="shadow-[0px_0px_0px_1.5px_#FFF_inset] w-full rounded-2xl border border-bytebot-bronze-light-5 aspect-[4/3] p-[1px] flex flex-col">
              <div
                  ref={containerRef}
                  className="overflow-hidden rounded-[14px]"
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

          {/* Chat Area */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            {/* Messages scrollable area */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
              <ChatContainer messages={messages} isLoadingSession={isLoadingSession} />
            </div>
            {/* Fixed chat input */}
            <div className="p-2 bg-bytebot-bronze-light-2 rounded-2xl border-[0.5px] border-bytebot-bronze-light-5 shadow-[0px_0px_0px_1.5px_#FFF_inset]">
              <ChatInput
                input={input}
                isLoading={isLoading}
                onInputChange={setInput}
                onSend={handleSend}
              />
              <div className="mt-2">
                <Select value="sonnet-3.7">
                  <SelectTrigger className="w-auto">
                    <SelectValue placeholder="Select an model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sonnet-3.7">Sonnet 3.7</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
