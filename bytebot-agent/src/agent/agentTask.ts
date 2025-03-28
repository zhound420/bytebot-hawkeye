import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { prisma } from "../lib/prisma";
import { MessageType, Prisma } from "@prisma/client";

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

import {
  key,
  hold_key,
  type,
  cursor_position,
  mouse_move,
  left_mouse_down,
  left_mouse_up,
  left_click,
  left_click_drag,
  right_click,
  middle_click,
  double_click,
  triple_click,
  scroll,
  wait,
  screenshot,
  ScrollDirection,
} from "./utils/computerActions";

const DEFAULT_VIEWPORT_WIDTH = 1280;
const DEFAULT_VIEWPORT_HEIGHT = 800;

// Simple mutex implementation
class AsyncMutex {
  private locked = false;
  private waitQueue: Array<() => void> = [];

  async acquire(): Promise<() => void> {
    while (this.locked) {
      await new Promise<void>((resolve) => this.waitQueue.push(resolve));
    }
    this.locked = true;
    return () => this.release();
  }

  private release(): void {
    this.locked = false;
    const next = this.waitQueue.shift();
    if (next) {
      next();
    }
  }
}

let isOnAutopilot = false;
const messageMutex = new AsyncMutex();
let currentTaskId: string | null = null;

export function setAutopilot(value: boolean) {
  if (isOnAutopilot === value) {
    return;
  }

  isOnAutopilot = value;
  console.log("Autopilot state changed to:", value);

  if (value) {
    runAgent();
  }
}

export function setCurrentTaskId(taskId: string) {
  currentTaskId = taskId;
}

const messageStore: Anthropic.Beta.BetaMessageParam[] = [
  {
    role: "user",
    content: [
      {
        type: "text",
        text: `You are a Engineer working with a computer. Try your best to follow the user's instructions. When you choose to take an action, 
          do so how a human would. For example, if you need to click on something, click confidently 
          roughly in the center of the element. To open a program, double click on its icon. If you need to type something, type a realistic example 
          of what a user would type based on the context of the site, page and task. Always make sure the 
          previous action was completed before taking the next action, where applicable.`,
      },
    ],
  },
];

// Helper function to save message to database
async function saveMessageToDatabase(message: Anthropic.Beta.BetaMessageParam) {
  if (!currentTaskId) {
    console.warn("No current task ID set, skipping database save");
    return;
  }

  try {
    const messageType =
      message.role === "user" ? MessageType.USER : MessageType.ASSISTANT;

    await prisma.message.create({
      data: {
        content: message.content as unknown as Prisma.InputJsonValue, // Store the content blocks as JSON
        type: messageType,
        taskId: currentTaskId,
      },
    });

    console.log(`Saved ${messageType} message to database`);
  } catch (error) {
    console.error("Failed to save message to database:", error);
  }
}

// Update the addMessage function to be async and thread-safe
async function addMessage(message: Anthropic.Beta.BetaMessageParam) {
  const release = await messageMutex.acquire();
  try {
    messageStore.push(message);
    await saveMessageToDatabase(message);
  } finally {
    release();
  }
}

// Update getMessages to be thread-safe
export async function getMessages(): Promise<
  Anthropic.Beta.BetaMessageParam[]
> {
  const release = await messageMutex.acquire();
  try {
    return [...messageStore];
  } finally {
    release();
  }
}

// Update addUserMessage to be async
export async function addUserMessage(message: string) {
  await addMessage({
    role: "user",
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  });
}

export const client = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export const callAnthropicComputerUse = async (
  messages: Anthropic.Beta.BetaMessageParam[],
  displaySize: { width: number; height: number }
): Promise<Anthropic.Beta.Messages.BetaMessage> => {
  const response = await client.beta.messages.create({
    model: "claude-3-7-sonnet-20250219",
    max_tokens: 8192,
    messages: messages,
    tools: [
      {
        type: "computer_20250124",
        name: "computer",
        display_width_px: displaySize.width,
        display_height_px: displaySize.height,
        display_number: 1,
      },
    ],
    betas: ["computer-use-2025-01-24"],
    // thinking: { type: "enabled", budget_tokens: 1024 },
  });

  return response;
};

export type ToolCall = {
  action:
    | "key"
    | "hold_key"
    | "type"
    | "cursor_position"
    | "mouse_move"
    | "left_mouse_down"
    | "left_mouse_up"
    | "left_click"
    | "left_click_drag"
    | "right_click"
    | "middle_click"
    | "double_click"
    | "triple_click"
    | "scroll"
    | "wait"
    | "screenshot";
  coordinate: [number, number];
  start_coordinate: [number, number];
  text: string;
  scroll_amount: number;
  scroll_direction: ScrollDirection;
  duration: number;
};

const handleText = async (text: string) => {
  const message: Anthropic.Beta.BetaMessageParam = {
    role: "assistant",
    content: [{ type: "text", text: text }],
  };

  await addMessage(message);
};

const handleComputerToolUse = async (
  content: Anthropic.Beta.Messages.BetaContentBlock
) => {
  const release = await messageMutex.acquire();
  if (content.type !== "tool_use") {
    return;
  }

  try {
    const assistantMessage: Anthropic.Beta.BetaMessageParam = {
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: content.id,
          input: content.input,
          name: content.name,
        },
      ],
    };

    messageStore.push(assistantMessage);
    await saveMessageToDatabase(assistantMessage);

    const toolCall: ToolCall = content.input as ToolCall;

    if (toolCall.action === "screenshot") {
      const image = await screenshot();

      const userResponseMessage: Anthropic.Beta.BetaMessageParam = {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: content.id,
            content: [
              {
                type: "image",
                source: {
                  data: image,
                  media_type: "image/png",
                  type: "base64",
                },
              },
            ],
          },
        ],
      };

      messageStore.push(userResponseMessage);
      await saveMessageToDatabase(userResponseMessage);
    } else {
      switch (toolCall.action) {
        case "key":
          await key(toolCall.text);
          break;
        case "hold_key":
          await hold_key(toolCall.text, toolCall.duration);
          break;
        case "type":
          await type(toolCall.text);
          break;
        case "mouse_move":
          await mouse_move({
            x: toolCall.coordinate[0],
            y: toolCall.coordinate[1],
          });
          break;

        case "left_mouse_down":
          await left_mouse_down();
          break;
        case "left_mouse_up":
          await left_mouse_up();
          break;
        case "left_click":
          await left_click({
            x: toolCall.coordinate[0],
            y: toolCall.coordinate[1],
          });
          break;
        case "left_click_drag":
          await left_click_drag(
            {
              x: toolCall.start_coordinate[0],
              y: toolCall.start_coordinate[1],
            },
            {
              x: toolCall.coordinate[0],
              y: toolCall.coordinate[1],
            },
            toolCall.text?.split("+") ?? []
          );
          break;
        case "right_click":
          await right_click({
            x: toolCall.coordinate[0],
            y: toolCall.coordinate[1],
          });
          break;
        case "middle_click":
          await middle_click({
            x: toolCall.coordinate[0],
            y: toolCall.coordinate[1],
          });
          break;
        case "double_click":
          await double_click({
            x: toolCall.coordinate[0],
            y: toolCall.coordinate[1],
          });
          break;
        case "triple_click":
          await triple_click({
            x: toolCall.coordinate[0],
            y: toolCall.coordinate[1],
          });
          break;
        case "scroll":
          await scroll(
            {
              x: toolCall.coordinate[0],
              y: toolCall.coordinate[1],
            },
            toolCall.scroll_direction,
            toolCall.scroll_amount
          );
          break;
        case "wait":
          await wait(toolCall.duration);
          break;
        case "cursor_position":
          await cursor_position();
          break;
      }

      const userResponseMessage: Anthropic.Beta.BetaMessageParam = {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: content.id,
            content: [
              {
                type: "text",
                text: "Success",
              },
            ],
          },
        ],
      };

      messageStore.push(userResponseMessage);
      await saveMessageToDatabase(userResponseMessage);
    }
  } catch (error) {
    const errorMessage: Anthropic.Beta.BetaMessageParam = {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: content.id,
          content: [
            { type: "text", text: "ERROR: Failed to perform tool use" },
          ],
        },
      ],
    };

    messageStore.push(errorMessage);
    await saveMessageToDatabase(errorMessage);
    console.error("[agent.ts] handleComputerToolUse", error);
  } finally {
    release();
  }
};

export async function runAgent() {
  console.log("Running agent");
  while (isOnAutopilot) {
    let currentMessages = await getMessages();

    // Strip images from all but the last message
    currentMessages = currentMessages.map((msg, index) => {
      if (index === currentMessages.length - 1) return msg; // Keep the last message intact
      if (Array.isArray(msg.content)) {
        return {
          ...msg,
          content: msg.content.map((item) => {
            if (
              item.type === "tool_result" &&
              typeof item.content !== "string"
            ) {
              return {
                ...item,
                content: item.content?.filter((c) => c.type !== "image"),
              };
            }
            return item;
          }),
        };
      }
      return msg;
    });

    const response = await callAnthropicComputerUse(currentMessages, {
      width: DEFAULT_VIEWPORT_WIDTH,
      height: DEFAULT_VIEWPORT_HEIGHT,
    });
    if (!isOnAutopilot) {
      return;
    }

    const containsToolUse = response.content.some(
      (content) => content.type === "tool_use"
    );

    console.log(response.content);

    // Process each content item sequentially
    for (const content of response.content) {
      if (!isOnAutopilot) {
        return;
      }

      if (content.type === "text") {
        await handleText(content.text);
      }

      if (content.type === "tool_use") {
        switch (content.name) {
          case "computer":
            await handleComputerToolUse(content);
            break;

          default:
            throw new Error("Unknown tool name: " + content.name);
        }
      }
    }

    if (!containsToolUse) {
      break;
    }
  }
}

export async function triggerAgentWithMessage(
  initialMessage: string,
  taskId?: string
) {
  if (taskId) {
    setCurrentTaskId(taskId);
  }

  await addUserMessage(initialMessage);
  setAutopilot(true); // Starts the autopilot, invoking runAgent()
}
