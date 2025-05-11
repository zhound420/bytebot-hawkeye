import { Message } from "@/types";

/**
 * Fetches messages for a specific task
 * @param taskId The ID of the task to fetch messages for
 * @returns Array of new messages
 */
export async function fetchMessages(taskId: string): Promise<Message[]> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/tasks/${taskId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch messages");
    }

    const task = await response.json();
    return task.messages || [];
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
}

/**
 * Fetches a specific task by ID
 * @param taskId The ID of the task to fetch
 * @returns The task data or null if not found
 */
export async function fetchTaskById(taskId: string): Promise<{
  id: string;
  messages: Message[];
} | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/tasks/${taskId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch task with ID ${taskId}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching task ${taskId}:`, error);
    return null;
  }
}

/**
 * Sends a message to start a new task or continue an existing one
 * @param message The message content to send
 * @returns The task data or null if there was an error
 */

export async function sendMessage(
  message: string
): Promise<{ id: string } | null> {
  try {
    const response = await fetch("${process.env.NEXT_PUBLIC_API_BASE_URL}/tasks", {
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
export async function fetchLatestTask(): Promise<{
  id: string;
  messages: Message[];
} | null> {
  try {
    const response = await fetch("${process.env.NEXT_PUBLIC_API_BASE_URL}/tasks/in-progress", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch latest task");
    }

    const task = await response.json();
    return task || null;
  } catch (error) {
    console.error("Error fetching latest task:", error);
    return null;
  }
}
