import { useState, useEffect, useRef, useCallback } from 'react';
import { Message } from '@/types';
import { 
  fetchMessages, 
  sendMessage, 
  fetchLatestTask, 
  loadTaskFromLocalStorage,
  saveTaskToLocalStorage
} from '@/utils/messageUtils';

export function useChatSession() {
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
      const newMessages = await fetchMessages(taskId, lastMessageId);
      
      if (newMessages && newMessages.length > 0) {
        // Filter out messages we've already processed to prevent duplicates
        const filteredMessages = newMessages.filter(
          (msg: Message) => !processedMessageIds.current.has(msg.id)
        );

        if (filteredMessages.length > 0) {
          console.log(`Adding ${filteredMessages.length} new messages to chat`);

          // Add new message IDs to the processed set
          filteredMessages.forEach((msg: Message) => {
            processedMessageIds.current.add(msg.id);
          });

          // Add new messages to state
          setMessages((prev) => [...prev, ...filteredMessages]);

          // Update the last message ID
          setLastMessageId(newMessages[newMessages.length - 1].id);
        }
      }
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  }, [lastMessageId]);

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

  // Load task ID from local storage or fetch the latest task on initial render
  useEffect(() => {
    const loadSession = async () => {
      setIsLoadingSession(true);
      try {
        // First check if there's a saved task ID in local storage
        const savedTaskId = loadTaskFromLocalStorage();
        
        if (savedTaskId) {
          setCurrentTaskId(savedTaskId);
        } else {
          // If no saved task ID, fetch the latest task from the database
          console.log('Fetching latest task from database...');
          const latestTask = await fetchLatestTask();
          
          if (latestTask) {
            console.log(`Found latest task: ${latestTask.id}`);
            setCurrentTaskId(latestTask.id);
            
            // If the task has an initial message, add it to the messages
            if (latestTask.messages && latestTask.messages.length > 0) {
              const initialMessage = latestTask.messages[0];
              
              const formattedMessage: Message = {
                id: initialMessage.id,
                content: initialMessage.content,
                role: initialMessage.type,
                createdAt: initialMessage.createdAt
              };
              
              processedMessageIds.current.add(initialMessage.id);
              setMessages([formattedMessage]);
            }
          } else {
            console.log('No active tasks found');
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
    saveTaskToLocalStorage(currentTaskId);
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
      const data = await sendMessage(input);

      if (data) {
        // Reset processed message IDs when starting a new task
        if (currentTaskId !== data.task.id) {
          processedMessageIds.current = new Set([userMessage.id]);
        }

        // Store the task ID for polling
        setCurrentTaskId(data.task.id);
      } else {
        // Add error message to chat
        const errorMessage: Message = {
          id: Date.now().toString(),
          content: "Sorry, there was an error processing your request. Please try again.",
          role: "assistant",
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
    
    // Clear last message ID
    setLastMessageId(null);
    
    // Clear processed message IDs
    processedMessageIds.current = new Set();
    
    // Remove from local storage
    saveTaskToLocalStorage(null);
    
    console.log('Started new conversation');
  };

  return {
    messages,
    input,
    setInput,
    currentTaskId,
    isLoading,
    isLoadingSession,
    handleSend,
    startNewConversation
  };
}
