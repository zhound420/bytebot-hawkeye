import { Message, TASK_ID_STORAGE_KEY } from '@/types';

/**
 * Fetches messages for a specific task
 * @param taskId The ID of the task to fetch messages for
 * @param lastMessageId Optional ID of the last message received
 * @returns Array of new messages
 */
export async function fetchMessages(taskId: string, lastMessageId: string | null): Promise<Message[]> {
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
    return data.messages || [];
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

/**
 * Sends a message to start a new task or continue an existing one
 * @param message The message content to send
 * @returns The task data or null if there was an error
 */
export async function sendMessage(message: string): Promise<any> {
  try {
    const response = await fetch("/api/start-task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: message }),
    });

    if (!response.ok) {
      throw new Error("Failed to start task");
    }

    return await response.json();
  } catch (error) {
    console.error("Error sending message:", error);
    return null;
  }
}

/**
 * Fetches the latest task from the server
 * @returns The latest task or null if none found
 */
export async function fetchLatestTask(): Promise<any> {
  try {
    const response = await fetch('/api/latest-task');
    
    if (!response.ok) {
      throw new Error("Failed to fetch latest task");
    }
    
    const data = await response.json();
    return data.task || null;
  } catch (error) {
    console.error('Error fetching latest task:', error);
    return null;
  }
}

/**
 * Saves the task ID to local storage
 * @param taskId The task ID to save
 */
export function saveTaskToLocalStorage(taskId: string | null): void {
  if (taskId) {
    localStorage.setItem(TASK_ID_STORAGE_KEY, taskId);
    console.log(`Saved task ID to local storage: ${taskId}`);
  } else {
    localStorage.removeItem(TASK_ID_STORAGE_KEY);
    console.log('Removed task ID from local storage');
  }
}

/**
 * Loads the task ID from local storage
 * @returns The saved task ID or null if none found
 */
export function loadTaskFromLocalStorage(): string | null {
  const savedTaskId = localStorage.getItem(TASK_ID_STORAGE_KEY);
  if (savedTaskId) {
    console.log(`Loaded task ID from local storage: ${savedTaskId}`);
  }
  return savedTaskId;
}
