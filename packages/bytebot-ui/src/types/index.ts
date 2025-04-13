import { MessageContentBlock } from "../../../shared/types/messageContent.types";

export enum MessageRole {
  USER,
  ASSISTANT,
}

// Message interface
export interface Message {
  id: string;
  content: MessageContentBlock[];
  role: MessageRole;
  createdAt?: string;
}
