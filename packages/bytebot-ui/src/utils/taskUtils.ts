import { Task } from "@/types";

/**
 * Fetches tasks
 * @returns Array of tasks
 */
export async function fetchTasks(): Promise<Task[]> {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/tasks`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch tasks");
    }

    const tasks = await response.json();
    return tasks || [];
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
}
