import {
  MessageContentBlock,
  MessageContentType,
  TextContentBlock,
  ImageContentBlock,
  ToolUseContentBlock,
  ComputerToolUseContentBlock,
  ToolResultContentBlock,
  MoveMouseToolUseBlock,
  TraceMouseToolUseBlock,
  ClickMouseToolUseBlock,
  PressMouseToolUseBlock,
  TypeKeysToolUseBlock,
  PressKeysToolUseBlock,
  TypeTextToolUseBlock,
  WaitToolUseBlock,
  ScreenshotToolUseBlock,
  CursorPositionToolUseBlock,
  DragMouseToolUseBlock,
  ScrollToolUseBlock,
  Coordinates,
  Button,
  Press,
} from "../types/messageContent.types";

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
    block.source !== undefined &&
    typeof block.source === "object" &&
    typeof block.source.media_type === "string" &&
    typeof block.source.type === "string" &&
    typeof block.source.data === "string"
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
    typeof block.name === "string" &&
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

  return (obj as ToolUseContentBlock).name.startsWith("computer_");
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
    if (computerBlock.input && typeof computerBlock.input === "object") {
      return `ComputerToolUseContentBlock:${computerBlock.name.replace(
        "computer_",
        ""
      )}`;
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
 * Type guard to check if an object is a MoveMouseToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is MoveMouseToolUseBlock
 */
export function isMoveMouseToolUseBlock(
  obj: unknown
): obj is MoveMouseToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_move_mouse";
}

export function createMoveMouseToolUseBlock(content: {
  id: string;
  coordinates: Coordinates;
}): MoveMouseToolUseBlock {
  const { id, coordinates } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_move_mouse",
    id,
    input: {
      coordinates,
    },
  };
}

/**
 * Type guard to check if an object is a TraceMouseToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is TraceMouseToolUseBlock
 */
export function isTraceMouseToolUseBlock(
  obj: unknown
): obj is TraceMouseToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_trace_mouse";
}

export function createTraceMouseToolUseBlock(content: {
  id: string;
  path: Coordinates[];
  holdKeys?: string[];
}): TraceMouseToolUseBlock {
  const { id, path, holdKeys } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_trace_mouse",
    id,
    input: {
      path,
      holdKeys,
    },
  };
}

/**
 * Type guard to check if an object is a ClickMouseToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is ClickMouseToolUseBlock
 */
export function isClickMouseToolUseBlock(
  obj: unknown
): obj is ClickMouseToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_click_mouse";
}

export function createClickMouseToolUseBlock(content: {
  id: string;
  button: Button;
  coordinates?: Coordinates;
  holdKeys?: string[];
  numClicks?: number;
}): ClickMouseToolUseBlock {
  const { id, button, coordinates, holdKeys, numClicks } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_click_mouse",
    id,
    input: {
      coordinates,
      button,
      holdKeys,
      numClicks,
    },
  };
}

/**
 * Type guard to check if an object is a CursorPositionToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is CursorPositionToolUseBlock
 */
export function isCursorPositionToolUseBlock(
  obj: unknown
): obj is CursorPositionToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_cursor_position";
}

export function createCursorPositionToolUseBlock(content: {
  id: string;
}): CursorPositionToolUseBlock {
  const { id } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_cursor_position",
    id,
    input: {},
  };
}

/**
 * Type guard to check if an object is a PressMouseToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is PressMouseToolUseBlock
 */
export function isPressMouseToolUseBlock(
  obj: unknown
): obj is PressMouseToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_press_mouse";
}

export function createPressMouseToolUseBlock(content: {
  id: string;
  button: Button;
  press: Press;
  coordinates?: Coordinates;
}): PressMouseToolUseBlock {
  const { id, button, press, coordinates } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_press_mouse",
    id,
    input: {
      button,
      press,
      coordinates,
    },
  };
}

/**
 * Type guard to check if an object is a DragMouseToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is DragMouseToolUseBlock
 */
export function isDragMouseToolUseBlock(
  obj: unknown
): obj is DragMouseToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_drag_mouse";
}

export function createDragMouseToolUseBlock(content: {
  id: string;
  path: Coordinates[];
  button: Button;
  holdKeys?: string[];
}): DragMouseToolUseBlock {
  const { id, path, button, holdKeys } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_drag_mouse",
    id,
    input: {
      path,
      button,
      holdKeys,
    },
  };
}

/**
 * Type guard to check if an object is a ScrollToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is ScrollToolUseBlock
 */
export function isScrollToolUseBlock(obj: unknown): obj is ScrollToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_scroll";
}

export function createScrollToolUseBlock(content: {
  id: string;
  direction: "up" | "down" | "left" | "right";
  coordinates?: Coordinates;
  numScrolls: number;
  holdKeys?: string[];
}): ScrollToolUseBlock {
  const { id, direction, coordinates, numScrolls, holdKeys } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_scroll",
    id,
    input: {
      coordinates,
      direction,
      numScrolls,
      holdKeys,
    },
  };
}

/**
 * Type guard to check if an object is a TypeKeysToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is TypeKeysToolUseBlock
 */
export function isTypeKeysToolUseBlock(
  obj: unknown
): obj is TypeKeysToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_type_keys";
}

export function createTypeKeysToolUseBlock(content: {
  id: string;
  keys: string[];
  delay?: number;
}): TypeKeysToolUseBlock {
  const { id, keys, delay } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_type_keys",
    id,
    input: {
      keys,
      delay,
    },
  };
}

/**
 * Type guard to check if an object is a PressKeysToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is PressKeysToolUseBlock
 */
export function isPressKeysToolUseBlock(
  obj: unknown
): obj is PressKeysToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_press_keys";
}

export function createPressKeysToolUseBlock(content: {
  id: string;
  keys: string[];
  press: Press;
}): PressKeysToolUseBlock {
  const { id, keys, press } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_press_keys",
    id,
    input: {
      keys,
      press,
    },
  };
}

/**
 * Type guard to check if an object is a TypeTextToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is TypeTextToolUseBlock
 */
export function isTypeTextToolUseBlock(
  obj: unknown
): obj is TypeTextToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_type_text";
}

export function createTypeTextToolUseBlock(content: {
  id: string;
  text: string;
  delay?: number;
}): TypeTextToolUseBlock {
  const { id, text, delay } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_type_text",
    id,
    input: {
      text,
      delay,
    },
  };
}

/**
 * Type guard to check if an object is a WaitToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is WaitToolUseBlock
 */
export function isWaitToolUseBlock(obj: unknown): obj is WaitToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_wait";
}

export function createWaitToolUseBlock(content: {
  id: string;
  duration: number;
}): WaitToolUseBlock {
  const { id, duration } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_wait",
    id,
    input: {
      duration,
    },
  };
}

/**
 * Type guard to check if an object is a ScreenshotToolUseBlock
 * @param obj The object to validate
 * @returns Type predicate indicating obj is ScreenshotToolUseBlock
 */
export function isScreenshotToolUseBlock(
  obj: unknown
): obj is ScreenshotToolUseBlock {
  if (!isComputerToolUseContentBlock(obj)) {
    return false;
  }

  const block = obj as Record<string, any>;
  return block.name === "computer_screenshot";
}

export function createScreenshotToolUseBlock(content: {
  id: string;
}): ScreenshotToolUseBlock {
  const { id } = content;
  return {
    type: MessageContentType.ToolUse,
    name: "computer_screenshot",
    id,
    input: {},
  };
}
