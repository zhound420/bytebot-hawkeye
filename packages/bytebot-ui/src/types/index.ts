import { MessageContentBlock } from "../../../shared/types/messageContent.types";

export enum MessageType {
  USER,
  ASSISTANT,
}

// Message interface
export interface Message {
  id: string;
  content: MessageContentBlock[];
  role: MessageType;
  createdAt?: string;
}
