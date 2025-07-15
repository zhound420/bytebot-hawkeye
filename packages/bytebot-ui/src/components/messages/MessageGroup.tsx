import React from "react";
import { Role } from "@/types";
import { GroupedMessages } from "@/types";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";

interface MessageGroupProps {
  group: GroupedMessages;
  messageIdToIndex: Record<string, number>;
}

export function MessageGroup({ group, messageIdToIndex }: MessageGroupProps) {
  if (group.role === Role.ASSISTANT) {
    return <AssistantMessage group={group} messageIdToIndex={messageIdToIndex} />;
  }

  return <UserMessage group={group} messageIdToIndex={messageIdToIndex} />;
}