import React from "react";
import { User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Image from "next/image";
import { Message, MessageRole } from "@/types";
import {
  isImageContentBlock,
  isTextContentBlock,
} from "../../../../shared/utils/messageContent.utils";

interface MessageItemProps {
  message: Message;
}

export function MessageItem({ message }: MessageItemProps) {
  if (message.role === MessageRole.ASSISTANT) {
    return <AssistantMessage message={message} />;
  }

  return <UserMessage message={message} />;
}

function AssistantMessage({ message }: MessageItemProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
        <span className="text-primary-foreground text-xs">B</span>
      </div>
      <div className="text-sm">
        {typeof message.content === "string" ? (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        ) : (
          <div>
            {message.content.map((block, index) => (
              <div key={index} className="mb-2">
                {isTextContentBlock(block) && (
                  <ReactMarkdown>{block.text}</ReactMarkdown>
                )}
                {isImageContentBlock(block) && (
                  <div className="my-2">
                    <Image
                      src={`data:${block.source.data};base64,${block.source.media_type}`}
                      alt="Image in message"
                      width={500}
                      height={300}
                      className="max-w-full rounded-md object-contain"
                      style={{ maxHeight: "300px" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessage({ message }: MessageItemProps) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center">
        <User className="h-3 w-3" />
      </div>
      <div className="text-sm">
        {typeof message.content === "string" ? (
          <ReactMarkdown>{message.content}</ReactMarkdown>
        ) : (
          message.content.map((block, index) =>
            isTextContentBlock(block) ? (
              <ReactMarkdown key={index}>{block.text}</ReactMarkdown>
            ) : null
          )
        )}
      </div>
    </div>
  );
}
