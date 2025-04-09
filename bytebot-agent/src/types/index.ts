import { MessageType } from '@prisma/client';

// Content block types
export interface ContentBlock {
  type: 'text' | 'image';
  text?: string;
  image?: {
    media_type: string;
    data: string;
  };
}

// Message interface
export interface Message {
  id: string;
  content: ContentBlock[] | string;
  role: MessageType;
  createdAt?: string;
}

// Local storage key for task ID
export const TASK_ID_STORAGE_KEY = 'bytebot_current_task_id';
