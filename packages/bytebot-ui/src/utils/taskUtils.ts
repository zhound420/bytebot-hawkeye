import { Message, Task } from "@/types";

/**
 * Base configuration for API requests
 */
const API_CONFIG = {
  baseUrl: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  credentials: 'include' as RequestCredentials,
};

/**
 * Generic API request handler
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T | null> {
  try {
    const response = await fetch(`${API_CONFIG.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...API_CONFIG.headers,
        ...options.headers,
      },
      credentials: API_CONFIG.credentials,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Error in API request to ${endpoint}:`, error);
    return null;
  }
}

/**
 * Build query string from parameters
 */
function buildQueryString(params: Record<string, string | number | boolean>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, value.toString());
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

/**
 * Fetches messages for a specific task
 */
export async function fetchTaskMessages(
  taskId: string,
  options?: {
    limit?: number;
    page?: number;
  }
): Promise<Message[]> {
  const queryString = options ? buildQueryString(options) : '';
  const result = await apiRequest<Message[]>(
    `/tasks/${taskId}/messages${queryString}`,
    { method: 'GET' }
  );
  return result || [];
}

/**
 * Fetches a specific task by ID
 */
export async function fetchTaskById(taskId: string): Promise<Task | null> {
  return apiRequest<Task>(`/tasks/${taskId}`, { method: 'GET' });
}

/**
 * Sends a message to start a new task
 */
export async function startTask(message: string): Promise<Task | null> {
  return apiRequest<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify({ description: message }),
  });
}

/**
 * Guides an existing task with a message
 */
export async function guideTask(
  taskId: string,
  message: string
): Promise<Task | null> {
  return apiRequest<Task>(`/tasks/${taskId}/guide`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

/**
 * Fetches all tasks
 */
export async function fetchTasks(): Promise<Task[]> {
  const result = await apiRequest<Task[]>('/tasks', { method: 'GET' });
  return result || [];
}

/**
 * Takes over control of a task
 */
export async function takeOverTask(taskId: string): Promise<Task | null> {
  return apiRequest<Task>(`/tasks/${taskId}/takeover`, { method: 'POST' });
}

/**
 * Resumes a paused or stopped task
 */
export async function resumeTask(taskId: string): Promise<Task | null> {
  return apiRequest<Task>(`/tasks/${taskId}/resume`, { method: 'POST' });
}
