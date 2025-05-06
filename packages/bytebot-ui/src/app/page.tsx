"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Header } from "@/components/layout/Header";
import { ChatInput } from "@/components/messages/ChatInput";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendMessage } from "@/utils/messageUtils";
import { TaskList } from "@/components/tasks/TaskList";

// Stock photo component for easy image switching
interface StockPhotoProps {
  src: string;
  alt?: string;
}

const StockPhoto: React.FC<StockPhotoProps> = ({ src, alt = "Decorative image" }) => {
  return (
    <div className="w-full h-full rounded-lg bg-white overflow-hidden">
      <div className="relative w-full h-full">
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover"
          priority
        />
      </div>
    </div>
  );
};

export default function Home() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const [activePopoverIndex, setActivePopoverIndex] = useState<number | null>(null);

  const handleSend = async () => {
    if (!input.trim()) return;

    setIsLoading(true);

    try {
      // Send request to start a new task
      const task = await sendMessage(input);

      if (task && task.id) {
        // Redirect to the task page
        router.push(`/tasks/${task.id}`);
      } else {
        // Handle error
        console.error("Failed to create task");
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle popover open state change
  const handleOpenChange = (isOpen: boolean, index: number) => {
    setActivePopoverIndex(isOpen ? index : null);
  };

  // Handle selecting a use case
  const handleSelectUseCase = (useCase: string) => {
    setInput(useCase);
    setActivePopoverIndex(null);
  };

  // Topic use cases for popovers
  const topicUseCases = {
    Research: [
      "Create a comprehensive report on computer use agents",
      "Find market trends for my industry",
      "Analyze competitor strategies"
    ],
    Create: [
      "Draft a blog post about AI trends",
      "Design a marketing campaign",
      "Create a content calendar"
    ],
    Plan: [
      "Develop a project timeline",
      "Create a business strategy",
      "Plan a product launch"
    ],
    Analyze: [
      "Analyze trending startup keywords on Product Hunt",
      "Review my website analytics",
      "Evaluate marketing campaign performance"
    ],
    Learn: [
      "Summarize the top blog posts from Hacker News",
      "Fetch YouTube videos about AI tools",
      "Collect insights from Reddit"
    ]
  };

  const renderTopicButtons = () => {
    const topicNames = Object.keys(topicUseCases) as Array<keyof typeof topicUseCases>;
    
    return (
      <div className="flex flex-wrap gap-1 mt-6 justify-start w-full relative">
        {/* Container for buttons */}
        <div className="flex flex-wrap gap-1 w-full">
          {topicNames.map((topic, index) => (
            <div key={topic} className="relative">
              <button 
                className={`cursor-pointer shadow-bytebot px-3 py-[5px] text-sm ${activePopoverIndex === index ? 'text-bytebot-bronze-light-12' : 'text-bytebot-bronze-light-11'} rounded-full bg-bytebot-bronze-light-3 border border-bytebot-bronze-light-a7 hover:bg-bytebot-bronze-light-2 transition-colors`}
                onClick={() => handleOpenChange(activePopoverIndex !== index, index)}
              >
                {topic}
              </button>
            </div>
          ))}
        </div>
        
        {/* Popover container positioned relative to the parent */}
        {activePopoverIndex !== null && (
          <div className="absolute z-40 top-full left-0 mt-1 w-[500px] bg-bytebot-bronze-light-2 shadow-bytebot rounded-xl border border-bytebot-bronze-light-7 overflow-hidden p-2">
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {topicUseCases[topicNames[activePopoverIndex]].map((useCase: string, idx: number) => (
                <div 
                  key={idx} 
                  className="text-sm text-bytebot-bronze-light-12 px-3 py-1.5 hover:bg-bytebot-bronze-light-3 cursor-pointer transition-colors rounded-lg"
                  onClick={() => {
                    console.log("Clicked use case:", useCase);
                    handleSelectUseCase(useCase);
                  }}
                >
                  {useCase}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Desktop grid layout (50/50 split) - only visible on large screens */}
        <div className="hidden lg:grid lg:grid-cols-2 lg:gap-8 h-full p-8">
          {/* Main content area */}
          <div className="flex flex-col items-center overflow-y-auto">
            <div className="flex flex-col items-center max-w-xl w-full">
              <div className="flex flex-col justify-start items-start w-full mb-6">
                <h1 className="text-2xl text-bytebot-bronze-light-12 mb-1">Got something brewing?</h1>
                <p className="text-2xl text-bytebot-bronze-light-10">Let&apos;s dive in!</p>
              </div>
              
              <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-5 rounded-2xl border-[0.5px] p-2 w-full shadow-bytebot">
                <ChatInput
                  input={input}
                  isLoading={isLoading}
                  onInputChange={setInput}
                  onSend={handleSend}
                  minLines={3}
                />
                <div className="mt-2">
                  <Select defaultValue="sonnet-3.7">
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sonnet-3.7">Model: Sonnet 3.7</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {renderTopicButtons()}

              {/* Task list section */}
              <div className="w-full mt-8 border-t border-bytebot-bronze-light-5 pt-6">
                <TaskList title="Latest Tasks" />
              </div>
            </div>
          </div>

          {/* Stock photo area - centered in its grid cell */}
          <div className="flex items-center justify-center px-6 pt-6">
            <div className="w-full h-full max-w-md aspect-square">
              <StockPhoto src="/stock-1.png" alt="Bytebot stock image" />
            </div>
          </div>
        </div>

        {/* Mobile layout - only visible on small/medium screens */}
        <div className="flex flex-col lg:hidden h-full">
          <div className="flex-1 flex flex-col items-center pt-10 px-4 overflow-y-auto">
            <div className="flex flex-col items-center max-w-xl w-full">
              <div className="flex flex-col justify-start items-start w-full mb-6">
                <h1 className="text-2xl text-bytebot-bronze-light-12 mb-1">Got something brewing?</h1>
                <p className="text-2xl text-bytebot-bronze-light-10">Let&apos;s dive in!</p>
              </div>
              
              <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-5 rounded-2xl border-[0.5px] p-2 shadow-bytebot w-full">
                <ChatInput
                  input={input}
                  isLoading={isLoading}
                  onInputChange={setInput}
                  onSend={handleSend}
                  minLines={3}
                />
                <div className="mt-2">
                  <Select defaultValue="sonnet-3.7">
                    <SelectTrigger className="w-auto">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sonnet-3.7">Model: Sonnet 3.7</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {renderTopicButtons()}

              {/* Task list section */}
              <div className="w-full mt-8 border-t border-bytebot-bronze-light-5 pt-6">
                <TaskList title="Latest Tasks" />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
