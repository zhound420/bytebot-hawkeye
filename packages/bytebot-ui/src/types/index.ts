import { MessageContentBlock } from "../../shared/types/messageContent.types";

export enum MessageRole {
  USER = "USER",
  ASSISTANT = "ASSISTANT",
}

// Message interface
export interface Message {
  id: string;
  content: MessageContentBlock[];
  role: MessageRole;
  createdAt?: string;
}

// Task related enums and types
export enum TaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  NEEDS_HELP = "NEEDS_HELP",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED"
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT"
}

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
  imageData?: {
    data: string;
    type: string;
    media_type: string;
  };
}
