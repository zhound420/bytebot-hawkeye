import {
  MessageContentBlock,
  MessageContentType,
  TextContentBlock,
  ImageContentBlock,
  ToolUseContentBlock,
  ComputerToolUseContentBlock,
  ToolResultContentBlock,
} from "../types/messageContent.types";
import { DEFAULT_COMPUTER_TOOL_USE_NAME } from "../constants";

/**
 * Type guard to check if an object is a TextContentBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is TextContentBlock
 */
export function isTextContentBlock(obj: unknown): obj is TextContentBlock {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const block = obj as Partial<TextContentBlock>;
  return (
    block.type === MessageContentType.Text && typeof block.text === "string"
  );
}

/**
 * Type guard to check if an object is an ImageContentBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is ImageContentBlock
 */
export function isImageContentBlock(obj: unknown): obj is ImageContentBlock {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const block = obj as Partial<ImageContentBlock>;
  return (
    block.type === MessageContentType.Image &&
    block.image !== undefined &&
    typeof block.image === "object" &&
    typeof block.image?.media_type === "string" &&
    typeof block.image?.data === "string"
  );
}

/**
 * Type guard to check if an object is a ToolUseContentBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is ToolUseContentBlock
 */
export function isToolUseContentBlock(
  obj: unknown
): obj is ToolUseContentBlock {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const block = obj as Partial<ToolUseContentBlock>;
  return (
    block.type === MessageContentType.ToolUse &&
    typeof block.tool_name === "string" &&
    typeof block.id === "string" &&
    block.input !== undefined &&
    typeof block.input === "object"
  );
}

/**
 * Type guard to check if an object is a ComputerToolUseContentBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is ComputerToolUseContentBlock
 */
export function isComputerToolUseContentBlock(
  obj: unknown
): obj is ComputerToolUseContentBlock {
  if (!isToolUseContentBlock(obj)) {
    return false;
  }

  return (
    (obj as ToolUseContentBlock).tool_name === DEFAULT_COMPUTER_TOOL_USE_NAME
  );
}

/**
 * Type guard to check if an object is a ToolResultContentBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is ToolResultContentBlock
 */
export function isToolResultContentBlock(
  obj: unknown
): obj is ToolResultContentBlock {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const block = obj as Partial<ToolResultContentBlock>;
  return (
    block.type === MessageContentType.ToolResult &&
    typeof block.tool_use_id === "string"
  );
}

/**
 * Type guard to check if an object is any type of MessageContentBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is MessageContentBlock
 */
export function isMessageContentBlock(
  obj: unknown
): obj is MessageContentBlock {
  return (
    isTextContentBlock(obj) ||
    isImageContentBlock(obj) ||
    isToolUseContentBlock(obj) ||
    isToolResultContentBlock(obj)
  );
}

/**
 * Determines the specific type of MessageContentBlock for a given object.
 * This doesn't narrow the type but can be useful for debugging or logging.
 * @param obj The object to check (should be a MessageContentBlock)
 * @returns A string indicating the specific type, or null if not a valid MessageContentBlock
 */
export function getMessageContentBlockType(obj: unknown): string | null {
  if (!obj || typeof obj !== "object") {
    return null;
  }

  if (isTextContentBlock(obj)) {
    return "TextContentBlock";
  }

  if (isImageContentBlock(obj)) {
    return "ImageContentBlock";
  }

  if (isComputerToolUseContentBlock(obj)) {
    const computerBlock = obj as ComputerToolUseContentBlock;
    if (
      computerBlock.input &&
      typeof computerBlock.input === "object" &&
      "action" in computerBlock.input
    ) {
      const action = (computerBlock.input as { action: string }).action;
      return `ComputerToolUseContentBlock:${action}`;
    }
    return "ComputerToolUseContentBlock";
  }

  if (isToolUseContentBlock(obj)) {
    return "ToolUseContentBlock";
  }

  if (isToolResultContentBlock(obj)) {
    return "ToolResultContentBlock";
  }

  return null;
}

/**
 * Type guard to check if an object is a KeyToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is KeyToolUseBlock
 */
export function isKeyToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").KeyToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.input?.action === "key" && typeof block.input?.text === "string";
}

/**
 * Type guard to check if an object is a HoldKeyToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is HoldKeyToolUseBlock
 */
export function isHoldKeyToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").HoldKeyToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "hold_key" &&
    typeof block.input?.text === "string" &&
    typeof block.input?.duration === "number"
  );
}

/**
 * Type guard to check if an object is a TypeToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is TypeToolUseBlock
 */
export function isTypeToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").TypeToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "type" && typeof block.input?.text === "string"
  );
}

/**
 * Type guard to check if an object is a CursorPositionToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is CursorPositionToolUseBlock
 */
export function isCursorPositionToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").CursorPositionToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.input?.action === "cursor_position";
}

/**
 * Type guard to check if an object is a MouseMoveToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is MouseMoveToolUseBlock
 */
export function isMouseMoveToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").MouseMoveToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "mouse_move" &&
    Array.isArray(block.input?.coordinate) &&
    block.input?.coordinate.length === 2 &&
    typeof block.input?.coordinate[0] === "number" &&
    typeof block.input?.coordinate[1] === "number"
  );
}

/**
 * Type guard to check if an object is a LeftMouseDownToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is LeftMouseDownToolUseBlock
 */
export function isLeftMouseDownToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").LeftMouseDownToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.input?.action === "left_mouse_down";
}

/**
 * Type guard to check if an object is a LeftMouseUpToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is LeftMouseUpToolUseBlock
 */
export function isLeftMouseUpToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").LeftMouseUpToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.input?.action === "left_mouse_up";
}

/**
 * Type guard to check if an object is a LeftClickToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is LeftClickToolUseBlock
 */
export function isLeftClickToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").LeftClickToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "left_click" &&
    Array.isArray(block.input?.coordinate) &&
    block.input?.coordinate.length === 2 &&
    typeof block.input?.coordinate[0] === "number" &&
    typeof block.input?.coordinate[1] === "number"
  );
}

/**
 * Type guard to check if an object is a LeftClickDragToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is LeftClickDragToolUseBlock
 */
export function isLeftClickDragToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").LeftClickDragToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "left_click_drag" &&
    Array.isArray(block.input?.start_coordinate) &&
    block.input?.start_coordinate.length === 2 &&
    typeof block.input?.start_coordinate[0] === "number" &&
    typeof block.input?.start_coordinate[1] === "number" &&
    Array.isArray(block.input?.coordinate) &&
    block.input?.coordinate.length === 2 &&
    typeof block.input?.coordinate[0] === "number" &&
    typeof block.input?.coordinate[1] === "number"
  );
}

/**
 * Type guard to check if an object is a RightClickToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is RightClickToolUseBlock
 */
export function isRightClickToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").RightClickToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "right_click" &&
    Array.isArray(block.input?.coordinate) &&
    block.input?.coordinate.length === 2 &&
    typeof block.input?.coordinate[0] === "number" &&
    typeof block.input?.coordinate[1] === "number"
  );
}

/**
 * Type guard to check if an object is a MiddleClickToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is MiddleClickToolUseBlock
 */
export function isMiddleClickToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").MiddleClickToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "middle_click" &&
    Array.isArray(block.input?.coordinate) &&
    block.input?.coordinate.length === 2 &&
    typeof block.input?.coordinate[0] === "number" &&
    typeof block.input?.coordinate[1] === "number"
  );
}

/**
 * Type guard to check if an object is a DoubleClickToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is DoubleClickToolUseBlock
 */
export function isDoubleClickToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").DoubleClickToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "double_click" &&
    Array.isArray(block.input?.coordinate) &&
    block.input?.coordinate.length === 2 &&
    typeof block.input?.coordinate[0] === "number" &&
    typeof block.input?.coordinate[1] === "number"
  );
}

/**
 * Type guard to check if an object is a TripleClickToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is TripleClickToolUseBlock
 */
export function isTripleClickToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").TripleClickToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "triple_click" &&
    Array.isArray(block.input?.coordinate) &&
    block.input?.coordinate.length === 2 &&
    typeof block.input?.coordinate[0] === "number" &&
    typeof block.input?.coordinate[1] === "number"
  );
}

/**
 * Type guard to check if an object is a ScrollToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is ScrollToolUseBlock
 */
export function isScrollToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").ScrollToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "scroll" &&
    Array.isArray(block.input?.coordinate) &&
    block.input?.coordinate.length === 2 &&
    typeof block.input?.coordinate[0] === "number" &&
    typeof block.input?.coordinate[1] === "number" &&
    typeof block.input?.scroll_amount === "number" &&
    typeof block.input?.scroll_direction === "string"
  );
}

/**
 * Type guard to check if an object is a WaitToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is WaitToolUseBlock
 */
export function isWaitToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").WaitToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return (
    block.input?.action === "wait" && typeof block.input?.duration === "number"
  );
}

/**
 * Type guard to check if an object is a ScreenshotToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is ScreenshotToolUseBlock
 */
export function isScreenshotToolUseBlock(
  obj: unknown
): obj is import("../types/messageContent.types").ScreenshotToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.input?.action === "screenshot";
}
