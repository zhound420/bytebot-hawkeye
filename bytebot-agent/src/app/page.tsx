"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  createdAt?: string;
}

export default function Home() {
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  // Use refs to track polling state to avoid closure issues
  const isPollingRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Track processed message IDs to prevent duplicates
  const processedMessageIds = useRef<Set<string>>(new Set());

  // Update ref when task ID changes
  useEffect(() => {
    currentTaskIdRef.current = currentTaskId;
  }, [currentTaskId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
    };
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Fetch new messages from the API
  const fetchNewMessages = useCallback(async () => {
    const taskId = currentTaskIdRef.current;
    if (!taskId) return;

    try {
      const queryParams = new URLSearchParams({
        taskId: taskId,
      });

      if (lastMessageId) {
        queryParams.append("lastMessageId", lastMessageId);
      }

      const response = await fetch(`/api/messages?${queryParams.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = await response.json();

      if (data.messages && data.messages.length > 0) {
        // Filter out messages we've already processed to prevent duplicates
        const newMessages = data.messages.filter(
          (msg: Message) => !processedMessageIds.current.has(msg.id)
        );

        if (newMessages.length > 0) {
          console.log(`Adding ${newMessages.length} new messages to chat`);

          // Add new message IDs to the processed set
          newMessages.forEach((msg: Message) => {
            processedMessageIds.current.add(msg.id);
          });

          // Add new messages to state
          setMessages((prev) => [...prev, ...newMessages]);

          // Update the last message ID
          setLastMessageId(data.messages[data.messages.length - 1].id);
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, [lastMessageId]);

  // Start polling for new messages - completely redesigned to prevent multiple intervals
  const startPolling = useCallback(() => {
    // If already polling, don't start another interval
    if (isPollingRef.current) {
      console.log("Already polling, not starting another interval");
      return;
    }

    console.log("Starting polling interval");
    isPollingRef.current = true;

    // Clear any existing interval just to be safe
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Poll immediately
    fetchNewMessages();

    // Then set up interval - use a longer interval (10 seconds) to reduce request frequency
    pollingIntervalRef.current = setInterval(() => {
      if (currentTaskIdRef.current) {
        fetchNewMessages();
      } else {
        // If task ID is no longer available, stop polling
        stopPolling();
      }
    }, 2000); // Poll every 2 seconds
  }, [fetchNewMessages]);

  // Stop polling for messages
  const stopPolling = useCallback(() => {
    console.log("Stopping polling");
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  // Set up polling when task ID changes
  useEffect(() => {
    if (currentTaskId && showChat) {
      // Only start polling if we have a task ID and are showing the chat
      startPolling();
    } else {
      // Otherwise stop polling
      stopPolling();
    }
  }, [currentTaskId, showChat, startPolling, stopPolling]);

  const handleWelcomeSubmit = (welcomeInput: string) => {
    if (!welcomeInput.trim()) return;

    setShowChat(true);

    // Process the initial input
    handleSend(welcomeInput);
  };

  const handleSend = async (inputParam?: string) => {
    const i = inputParam || input;
    if (!i.trim()) return;

    // Add user message to local state immediately for UI feedback
    const userMessage: Message = {
      id: Date.now().toString(),
      content: i,
      role: "user",
    };

    // Add to processed IDs to prevent duplicate
    processedMessageIds.current.add(userMessage.id);

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      // Send request to start a new task or continue existing task
      const response = await fetch("/api/start-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description: i }),
      });

      if (!response.ok) {
        throw new Error("Failed to start task");
      }

      const data = await response.json();

      // Reset processed message IDs when starting a new task
      if (currentTaskId !== data.task.id) {
        processedMessageIds.current = new Set([userMessage.id]);
      }

      // Store the task ID for polling
      setCurrentTaskId(data.task.id);
    } catch (error) {
      console.error("Error starting task:", error);

      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        content:
          "Sorry, there was an error processing your request. Please try again.",
        role: "assistant",
      };

      processedMessageIds.current.add(errorMessage.id);
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <Link href="/">
            <span className="font-medium">Bytebot</span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {!showChat ? (
        /* Welcome Screen */
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="flex flex-col items-center justify-center max-w-3xl mx-auto w-full">
            <h1 className="text-4xl font-bold mb-12">What can I help with?</h1>

            {/* Input area */}
            <div className="w-full mb-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleWelcomeSubmit(input);
                }}
                className="relative w-full"
              >
                <Input
                  placeholder="Ask me to do something"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full py-6 px-4 rounded-2xl shadow-sm border-gray-200 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* Chat Interface */
        <div className="flex flex-1 overflow-hidden">
          {/* Left side - VNC client */}
          <div className="w-3/5 border-r relative">
            <div className="h-full bg-muted/30">
              <iframe
                src="http://localhost:6081/vnc.html?autoconnect=true"
                style={{
                  width: "100%",
                  height: "100vh",
                  border: "none",
                }}
                allowFullScreen
              />
            </div>
          </div>

          {/* Right side - chat */}
          <div className="w-2/5 flex flex-col">
            <div ref={chatContainerRef} className="flex-1 overflow-auto p-4">
              {messages.map((message) => (
                <div key={message.id} className="mb-4">
                  {message.role === "assistant" && (
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground text-xs">
                          B
                        </span>
                      </div>
                      <div className="text-sm">{message.content}</div>
                    </div>
                  )}
                  {message.role === "user" && (
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-3 w-3" />
                      </div>
                      <div className="text-sm">{message.content}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="relative"
              >
                <Input
                  placeholder="Ask a follow up..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="pr-20 py-6"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Footer - only show on welcome screen */}
      {!showChat && (
        <footer className="p-4 text-center text-sm text-gray-500 dark:text-gray-400 border-t">
          <p>Hello from Bytebot</p>
        </footer>
      )}
    </div>
  );
}
