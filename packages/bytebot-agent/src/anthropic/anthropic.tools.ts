import Anthropic from '@anthropic-ai/sdk';
import {
  _moveMouseTool,
  _traceMouseTool,
  _clickMouseTool,
  _pressMouseTool,
  _dragMouseTool,
  _scrollTool,
  _typeKeysTool,
  _pressKeysTool,
  _typeTextTool,
  _waitTool,
  _screenshotTool,
  _cursorPositionTool,
  _setTaskStatusTool,
  _createTaskTool,
} from '../agent/agent.tools'; // Assuming this is the correct relative path

/**
 * Converts an agent tool definition to an Anthropic.Tool.
 * Since the structures are compatible, this primarily serves as a type assertion
 * and a clear point of conversion.
 * @param agentTool The tool definition from agent.tools.ts
 * @returns The tool definition typed as Anthropic.Tool
 */
function agentToolToAnthropicTool(agentTool: any): Anthropic.Tool {
  // Add any structural transformations here if needed in the future.
  // For now, it's a direct cast due to structural compatibility.
  return agentTool as Anthropic.Tool;
}

// Convert and re-export each tool
export const moveMouseTool: Anthropic.Tool =
  agentToolToAnthropicTool(_moveMouseTool);
export const traceMouseTool: Anthropic.Tool =
  agentToolToAnthropicTool(_traceMouseTool);
export const clickMouseTool: Anthropic.Tool =
  agentToolToAnthropicTool(_clickMouseTool);
export const pressMouseTool: Anthropic.Tool =
  agentToolToAnthropicTool(_pressMouseTool);
export const dragMouseTool: Anthropic.Tool =
  agentToolToAnthropicTool(_dragMouseTool);
export const scrollTool: Anthropic.Tool = agentToolToAnthropicTool(_scrollTool);
export const typeKeysTool: Anthropic.Tool =
  agentToolToAnthropicTool(_typeKeysTool);
export const pressKeysTool: Anthropic.Tool =
  agentToolToAnthropicTool(_pressKeysTool);
export const typeTextTool: Anthropic.Tool =
  agentToolToAnthropicTool(_typeTextTool);
export const waitTool: Anthropic.Tool = agentToolToAnthropicTool(_waitTool);
export const screenshotTool: Anthropic.Tool =
  agentToolToAnthropicTool(_screenshotTool);
export const cursorPositionTool: Anthropic.Tool =
  agentToolToAnthropicTool(_cursorPositionTool);
export const setTaskStatusTool: Anthropic.Tool =
  agentToolToAnthropicTool(_setTaskStatusTool);
export const createTaskTool: Anthropic.Tool =
  agentToolToAnthropicTool(_createTaskTool);

// Array of all tools, now using the converted and typed tools
export const anthropicTools: Anthropic.Tool[] = [
  moveMouseTool,
  traceMouseTool,
  clickMouseTool,
  pressMouseTool,
  dragMouseTool,
  scrollTool,
  typeKeysTool,
  pressKeysTool,
  typeTextTool,
  waitTool,
  screenshotTool,
  cursorPositionTool,
  setTaskStatusTool,
  createTaskTool,
];
