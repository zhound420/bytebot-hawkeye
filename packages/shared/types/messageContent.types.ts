import { DEFAULT_COMPUTER_TOOL_USE_NAME } from "../constants";

// Content block types
export enum MessageContentType {
  Text = "text",
  Image = "image",
  ToolUse = "tool_use",
  ToolResult = "tool_result",
}

// Base type with only the discriminator
export type MessageContentBlockBase = {
  type: MessageContentType;
  content: MessageContentBlock[] | string;
};

export type TextContentBlock = {
  type: MessageContentType.Text;
  text: string;
} & MessageContentBlockBase;

export type ImageContentBlock = {
  type: MessageContentType.Image;
  image: {
    media_type: string;
    data: string;
  };
} & MessageContentBlockBase;

export type ToolUseContentBlock = {
  type: MessageContentType.ToolUse;
  tool_name: string;
  id: string;
  input: Record<string, unknown>;
} & MessageContentBlockBase;

export type ComputerToolUseBlockBase = ToolUseContentBlock & {
  tool_name: typeof DEFAULT_COMPUTER_TOOL_USE_NAME;
};
export type KeyToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "key";
    text: string;
  };
};

export type HoldKeyToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "hold_key";
    text: string;
    duration: number;
  };
};

export type TypeToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "type";
    text: string;
  };
};

export type CursorPositionToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "cursor_position";
  };
};

export type MouseMoveToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "mouse_move";
    coordinate: [number, number];
  };
};

export type LeftMouseDownToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "left_mouse_down";
  };
};

export type LeftMouseUpToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "left_mouse_up";
  };
};

export type LeftClickToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "left_click";
    coordinate: [number, number];
  };
};

export type LeftClickDragToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "left_click_drag";
    start_coordinate: [number, number];
    coordinate: [number, number];
    text?: string;
  };
};

export type RightClickToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "right_click";
    coordinate: [number, number];
  };
};

export type MiddleClickToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "middle_click";
    coordinate: [number, number];
  };
};

export type DoubleClickToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "double_click";
    coordinate: [number, number];
  };
};

export type TripleClickToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "triple_click";
    coordinate: [number, number];
  };
};

export type ScrollToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "scroll";
    coordinate: [number, number];
    scroll_amount: number;
    scroll_direction: string;
  };
};

export type WaitToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "wait";
    duration: number;
  };
};

export type ScreenshotToolUseBlock = ComputerToolUseBlockBase & {
  input: {
    action: "screenshot";
  };
};

export type ComputerToolUseContentBlock =
  | ComputerToolUseBlockBase
  | KeyToolUseBlock
  | HoldKeyToolUseBlock
  | TypeToolUseBlock
  | CursorPositionToolUseBlock
  | MouseMoveToolUseBlock
  | LeftMouseDownToolUseBlock
  | LeftMouseUpToolUseBlock
  | LeftClickToolUseBlock
  | LeftClickDragToolUseBlock
  | RightClickToolUseBlock
  | MiddleClickToolUseBlock
  | DoubleClickToolUseBlock
  | TripleClickToolUseBlock
  | ScrollToolUseBlock
  | WaitToolUseBlock
  | ScreenshotToolUseBlock;

export type ToolResultContentBlock = {
  type: MessageContentType.ToolResult;
  tool_use_id: string;
} & MessageContentBlockBase;

// Union type of all possible content blocks
export type MessageContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | ToolUseContentBlock
  | ComputerToolUseContentBlock
  | ToolResultContentBlock;
