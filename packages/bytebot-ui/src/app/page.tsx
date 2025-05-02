"use client";

import React, { useState } from "react";
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

export default function Home() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />

      <main className="flex flex-1 flex-col items-center justify-center overflow-hidden">
        <div className="flex flex-col items-center max-w-xl w-full px-4">
          <h1 className="text-2xl font-semibold text-gray-800 mb-1">Got something brewing?</h1>
          <p className="text-gray-600 mb-6">Let&apos;s dive in!</p>
          
          <div className="bg-bytebot-bronze-light-2 border-bytebot-bronze-light-5 rounded-2xl border-[0.5px] p-2 shadow-[0px_0px_0px_1.5px_#FFF_inset] w-full">
            <ChatInput
              input={input}
              isLoading={isLoading}
              onInputChange={setInput}
              onSend={handleSend}
              minLines={3}
            />
            <div className="mt-2">
              <Select value="sonnet-3.7">
                <SelectTrigger className="w-auto">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sonnet-3.7">Sonnet 3.7</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* <div className="flex flex-wrap gap-2 mt-6 justify-center">
            <button className="px-4 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100">Research</button>
            <button className="px-4 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100">Create</button>
            <button className="px-4 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100">Plan</button>
            <button className="px-4 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100">Analyze</button>
            <button className="px-4 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100">Learn</button>
          </div> */}
        </div>
      </main>
    </div>
  );
}
