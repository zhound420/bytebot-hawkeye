import assert from "node:assert/strict";
import { test } from "node:test";
import {
  Role,
  TaskPriority,
  TaskStatus,
  TaskType,
  Task,
} from "@/types";
import { getTaskModelLabel } from "../TaskItem";

const baseTask: Task = {
  id: "task-1",
  description: "review pull request",
  type: TaskType.IMMEDIATE,
  status: TaskStatus.COMPLETED,
  priority: TaskPriority.MEDIUM,
  control: Role.ASSISTANT,
  createdBy: Role.USER,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  model: {
    provider: "OpenAI",
    name: "o1-mini",
    title: "OpenAI o1-mini",
  },
  files: [],
};

test("includes the provider when present", () => {
  assert.equal(getTaskModelLabel(baseTask), "OpenAI o1-mini (OpenAI)");
});

test("falls back to the model name when title is missing", () => {
  const taskWithoutTitle: Task = {
    ...baseTask,
    id: "task-2",
    model: {
      provider: "Anthropic",
      name: "claude-3.7-sonnet",
      title: "",
    },
  };

  assert.equal(getTaskModelLabel(taskWithoutTitle), "claude-3.7-sonnet (Anthropic)");
});

test("returns provider when title and name are unavailable", () => {
  const taskWithProviderOnly: Task = {
    ...baseTask,
    id: "task-3",
    model: {
      provider: "Custom",
      name: "",
      title: "",
    },
  };

  assert.equal(getTaskModelLabel(taskWithProviderOnly), "Custom");
});
