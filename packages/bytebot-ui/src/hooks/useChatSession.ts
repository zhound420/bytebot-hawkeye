import { useState, useEffect, useRef, useCallback } from "react";
import { Message, Role, TaskStatus } from "@/types";
import {
  guideTask,
  fetchTaskMessages,
  fetchTaskById,
  startTask,
} from "@/utils/taskUtils";
import { MessageContentType } from "@bytebot/shared";

interface UseChatSessionProps {
  initialTaskId?: string;
}

export function useChatSession({ initialTaskId }: UseChatSessionProps = {}) {
  const [taskStatus, setTaskStatus] = useState<TaskStatus>(TaskStatus.PENDING);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(
    initialTaskId || null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Use refs to track polling state to avoid closure issues
  const isPollingRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentTaskIdRef = useRef<string | null>(currentTaskId);
  const processedMessageIds = useRef<Set<string>>(new Set());

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
      const task = await fetchTaskById(taskId);
      const messages = await fetchTaskMessages(taskId);

      if (task && messages && messages.length > 0) {
        setTaskStatus(task.status);
        // Filter out messages we've already processed to prevent duplicates
        const filteredMessages = messages.filter(
          (msg: Message) => !processedMessageIds.current.has(msg.id),
        );

        if (filteredMessages.length > 0) {
          console.log(`Adding ${filteredMessages.length} new messages to chat`);

          // Add new message IDs to the processed set
          filteredMessages.forEach((msg: Message) => {
            processedMessageIds.current.add(msg.id);
          });

          // Add new messages to state
          setMessages((prev) => [...prev, ...filteredMessages]);
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, []);

  // Start polling for new messages
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

    // Then set up interval
    pollingIntervalRef.current = setInterval(() => {
      if (currentTaskIdRef.current) {
        fetchNewMessages();
      } else {
        // If task ID is no longer available, stop polling
        stopPolling();
      }
    }, 2000); // Poll every 2 seconds
  }, [fetchNewMessages, stopPolling]);

  // Load task ID from URL parameter or fetch the latest task on initial render
  useEffect(() => {
    const loadSession = async () => {
      setIsLoadingSession(true);
      try {
        if (initialTaskId) {
          // If we have an initial task ID (from URL), fetch that specific task
          console.log(`Fetching specific task: ${initialTaskId}`);
          const task = await fetchTaskById(initialTaskId);
          const messages = await fetchTaskMessages(initialTaskId);

          if (task) {
            console.log(`Found task: ${task.id}`);
            setCurrentTaskId(task.id);

            // If the task has messages, add them to the messages state
            if (messages && messages.length > 0) {
              // Process all messages
              const formattedMessages = messages.map((msg: Message) => ({
                id: msg.id,
                content: msg.content,
                role: msg.role,
                createdAt: msg.createdAt,
              }));

              // Add message IDs to processed set
              formattedMessages.forEach((msg: Message) => {
                processedMessageIds.current.add(msg.id);
              });

              setMessages(formattedMessages);
            }
          } else {
            console.log(`Task with ID ${initialTaskId} not found`);
          }
        }
      } catch (error) {
        console.error("Error loading session:", error);
      } finally {
        setIsLoadingSession(false);
      }
    };

    loadSession();
  }, [initialTaskId]);

  // Update the ref when the state changes
  useEffect(() => {
    currentTaskIdRef.current = currentTaskId;
  }, [currentTaskId]);

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

  const handleStartTask = async () => {
    if (!input.trim()) return;

    setIsLoading(true);

    try {
      const description = input;
      setInput("");

      startNewConversation();

      // Send request to start a new task or continue existing task
      const task = await startTask(description);

      if (task) {
        // Store the task ID for polling
        setCurrentTaskId(task.id);
      } else {
        // Add error message to chat
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: [
            {
              type: MessageContentType.Text,
              text: "Sorry, there was an error processing your request. Please try again.",
            },
          ],
          role: Role.ASSISTANT,
        };

        processedMessageIds.current.add(errorMessage.id);
        setMessages((prev) => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuideTask = async () => {
    if (!input.trim()) return;

    setIsLoading(true);

    try {
      const message = input;
      setInput("");

      // Send request to start a new task or continue existing task
      const response = await guideTask(currentTaskId!, message);

      if (!response) {
        // Add error message to chat
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: [
            {
              type: MessageContentType.Text,
              text: "Sorry, there was an error processing your request. Please try again.",
            },
          ],
          role: Role.ASSISTANT,
        };

        processedMessageIds.current.add(errorMessage.id);
        setMessages((prev) => [...prev, errorMessage]);
      }
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

    // Clear processed message IDs
    processedMessageIds.current = new Set();

    console.log("Started new conversation");
  };

  return {
    messages,
    taskStatus,
    input,
    setInput,
    currentTaskId,
    isLoading,
    isLoadingSession,
    handleGuideTask,
    handleStartTask,
    startNewConversation,
  };
}
