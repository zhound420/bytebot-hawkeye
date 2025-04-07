"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import Image from "next/image";
import ReactMarkdown from 'react-markdown';

// Updated Message interface to support structured content
interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  image?: {
    media_type: string;
    data: string;
  };
}

interface Message {
  id: string;
  content: ContentBlock[] | string;
  role: "user" | "assistant";
  createdAt?: string;
}

// Local storage key for task ID
const TASK_ID_STORAGE_KEY = 'bytebot_current_task_id';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Use refs to track polling state to avoid closure issues
  const isPollingRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTaskIdRef = useRef<string | null>(null);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  // Stop polling for messages
  const stopPolling = useCallback(() => {
    console.log("Stopping polling");
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

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
  }, [fetchNewMessages, stopPolling]);

  // Load task ID from local storage or fetch the latest task on initial render
  useEffect(() => {
    const loadSession = async () => {
      setIsLoadingSession(true);
      try {
        // First check if there's a saved task ID in local storage
        const savedTaskId = localStorage.getItem(TASK_ID_STORAGE_KEY);
        
        if (savedTaskId) {
          console.log(`Restored task ID from local storage: ${savedTaskId}`);
          setCurrentTaskId(savedTaskId);
        } else {
          // If no saved task ID, fetch the latest task from the database
          console.log('Fetching latest task from database...');
          const response = await fetch('/api/latest-task');
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.task) {
              console.log(`Found latest task: ${data.task.id}`);
              setCurrentTaskId(data.task.id);
              
              // If the task has an initial message, add it to the messages
              if (data.task.messages && data.task.messages.length > 0) {
                const initialMessage = data.task.messages[0];
                const messageRole = initialMessage.type === 'USER' ? 'user' : 'assistant';
                const formattedMessage: Message = {
                  id: initialMessage.id,
                  content: initialMessage.content,
                  role: messageRole as 'user' | 'assistant',
                  createdAt: initialMessage.createdAt
                };
                
                processedMessageIds.current.add(initialMessage.id);
                setMessages([formattedMessage]);
              }
            } else {
              console.log('No active tasks found');
            }
          } else {
            console.error('Failed to fetch latest task');
          }
        }
      } catch (error) {
        console.error('Error loading session:', error);
      } finally {
        setIsLoadingSession(false);
      }
    };
    
    loadSession();
  }, []);

  // Update the ref when the state changes and save to local storage
  useEffect(() => {
    currentTaskIdRef.current = currentTaskId;
    
    // Save to local storage when task ID changes
    if (currentTaskId) {
      localStorage.setItem(TASK_ID_STORAGE_KEY, currentTaskId);
      console.log(`Saved task ID to local storage: ${currentTaskId}`);
    } else {
      localStorage.removeItem(TASK_ID_STORAGE_KEY);
      console.log('Removed task ID from local storage');
    }
  }, [currentTaskId]);

  // Clean up polling on unmount
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

  // Set up polling when task ID changes
  useEffect(() => {
    if (currentTaskId) {
      // Start polling if we have a task ID
      startPolling();
    } else {
      // Otherwise stop polling
      stopPolling();
    }
  }, [currentTaskId, startPolling, stopPolling]);

  const handleSend = async () => {
    if (!input.trim()) return;

    setIsLoading(true);

    try {
      // Add user message to local state immediately for UI feedback
      const userMessage: Message = {
        id: Date.now().toString(),
        content: input,
        role: "user",
      };

      // Add to processed IDs to prevent duplicate
      processedMessageIds.current.add(userMessage.id);

      setMessages((prev) => [...prev, userMessage]);
      setInput("");

      // Send request to start a new task or continue existing task
      const response = await fetch("/api/start-task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ description: input }),
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
    } finally {
      setIsLoading(false);
    }
  };

  // Start a new conversation (clears current task)
  const startNewConversation = () => {
    // Clear the current task ID
    setCurrentTaskId(null);
    
    // Clear messages
    setMessages([]);
    
    // Clear last message ID
    setLastMessageId(null);
    
    // Clear processed message IDs
    processedMessageIds.current = new Set();
    
    // Remove from local storage
    localStorage.removeItem(TASK_ID_STORAGE_KEY);
    
    console.log('Started new conversation');
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
          {currentTaskId && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={startNewConversation}
              className="mr-2"
            >
              New Conversation
            </Button>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Main content - always show full interface */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left side - VNC client */}
        <div className="w-3/5 border-r relative">
          <div className="h-full bg-muted/30">
            <iframe
              src="http://localhost:6081/vnc.html?host=localhost&port=6080&resize=scale&autoconnect=true"
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
            {isLoadingSession ? (
              <div className="flex justify-center items-center h-full">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-primary"></div>
              </div>
            ) : messages.length > 0 ? (
              messages.map((message) => (
                <div key={message.id} className="mb-4">
                  {message.role === "assistant" && (
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-primary-foreground text-xs">
                          B
                        </span>
                      </div>
                      <div className="text-sm">
                        {typeof message.content === 'string' ? (
                          <ReactMarkdown>
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          <div>
                            {message.content.map((block, index) => (
                              <div key={index} className="mb-2">
                                {block.type === 'text' && block.text && (
                                  <ReactMarkdown>
                                    {block.text}
                                  </ReactMarkdown>
                                )}
                                {block.type === 'image' && block.image && (
                                  <div className="my-2">
                                    <Image 
                                      src={`data:${block.image.media_type};base64,${block.image.data}`}
                                      alt="Image in message"
                                      width={500}
                                      height={300}
                                      className="max-w-full rounded-md object-contain"
                                      style={{ maxHeight: '300px' }}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {message.role === "user" && (
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-3 w-3" />
                      </div>
                      <div className="text-sm">
                        {typeof message.content === 'string' ? (
                          <ReactMarkdown>
                            {message.content}
                          </ReactMarkdown>
                        ) : (
                          message.content.map((block, index) => 
                            block.type === 'text' && block.text ? (
                              <ReactMarkdown key={index}>
                                {block.text}
                              </ReactMarkdown>
                            ) : null
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="flex justify-center items-center h-full">
                <p className="text-muted">No messages yet...</p>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="p-4 border-t">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative"
            >
              <Input
                placeholder="Ask me to do something"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="w-full py-3 px-4 pr-10 rounded-md"
                disabled={isLoading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
                ) : (
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    disabled={isLoading}
                  >
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
