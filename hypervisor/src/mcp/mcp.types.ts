// MCP protocol message types and interfaces

import { z } from 'zod';

// Basic MCP message structure
export interface MCPMessage {
  messageType: string;
  messageId: string;
  payload: any;
}

// MCP request message types
export enum MCPRequestType {
  KEY = 'key',
  TYPE = 'type',
  MOUSE_MOVE = 'mouse_move',
  LEFT_CLICK = 'left_click',
  RIGHT_CLICK = 'right_click', 
  MIDDLE_CLICK = 'middle_click',
  DOUBLE_CLICK = 'double_click',
  LEFT_CLICK_DRAG = 'left_click_drag',
  SCROLL = 'scroll',
  SCREENSHOT = 'screenshot',
  CURSOR_POSITION = 'cursor_position'
}

// Input schemas for computer-use tools
export const KeyInputSchema = z.object({
  key: z.string().describe('A string representing the key (e.g. "enter", "a", etc.)')
});

export const TypeInputSchema = z.object({
  text: z.string().describe('The text to type'),
  delayMs: z.number().optional().default(100).describe('Optional delay in milliseconds between keystrokes')
});

export const MouseMoveInputSchema = z.object({
  x: z.number().describe('The absolute x-coordinate'),
  y: z.number().describe('The absolute y-coordinate')
});

export const LeftClickInputSchema = z.object({});

export const RightClickInputSchema = z.object({});

export const MiddleClickInputSchema = z.object({});

export const DoubleClickInputSchema = z.object({
  delayMs: z.number().optional().default(100).describe('Optional delay between clicks')
});

export const LeftClickDragInputSchema = z.object({
  startX: z.number().describe('Starting x-coordinate'),
  startY: z.number().describe('Starting y-coordinate'),
  endX: z.number().describe('Ending x-coordinate'),
  endY: z.number().describe('Ending y-coordinate'),
  holdMs: z.number().optional().default(100).describe('Optional delay (in ms) to hold the click before dragging')
});

export const ScrollInputSchema = z.object({
  amount: z.number().describe('The amount to scroll. Positive values scroll up, negative values scroll down'),
  axis: z.enum(['v', 'h']).optional().default('v').describe('Optional axis to scroll on. "v" for vertical, "h" for horizontal')
});

export const ScreenshotInputSchema = z.object({});

export const CursorPositionInputSchema = z.object({});

// Output schemas
export const CursorPositionOutputSchema = z.object({
  x: z.number().describe('The current x-coordinate of the cursor'),
  y: z.number().describe('The current y-coordinate of the cursor')
});

export const ScreenshotOutputSchema = z.object({
  image: z.string().describe('Base64 encoded image data with data URI prefix')
});

// MCP response message type
export interface MCPResponse {
  messageId: string;
  success: boolean;
  data?: any;
  error?: string;
}

// Export types derived from schemas
export type KeyInput = z.infer<typeof KeyInputSchema>;
export type TypeInput = z.infer<typeof TypeInputSchema>;
export type MouseMoveInput = z.infer<typeof MouseMoveInputSchema>;
export type LeftClickInput = z.infer<typeof LeftClickInputSchema>;
export type RightClickInput = z.infer<typeof RightClickInputSchema>;
export type MiddleClickInput = z.infer<typeof MiddleClickInputSchema>;
export type DoubleClickInput = z.infer<typeof DoubleClickInputSchema>;
export type LeftClickDragInput = z.infer<typeof LeftClickDragInputSchema>;
export type ScrollInput = z.infer<typeof ScrollInputSchema>;
export type ScreenshotInput = z.infer<typeof ScreenshotInputSchema>;
export type CursorPositionInput = z.infer<typeof CursorPositionInputSchema>;
