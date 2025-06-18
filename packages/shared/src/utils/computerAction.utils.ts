import {
  ClickMouseAction,
  DragMouseAction,
  MoveMouseAction,
  PressKeysAction,
  PressMouseAction,
  ScrollAction,
  TraceMouseAction,
  TypeKeysAction,
  TypeTextAction,
} from "../types/computerAction.types";
import {
  ComputerToolUseContentBlock,
  MessageContentType,
} from "../types/messageContent.types";

export function isMoveMouseAction(obj: unknown): obj is MoveMouseAction {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const action = obj as Record<string, any>;
  return action.action === "move_mouse";
}

export function convertMoveMouseActionToToolUseBlock(
  action: MoveMouseAction,
  toolUseId: string
): ComputerToolUseContentBlock {
  return {
    type: MessageContentType.ToolUse,
    id: toolUseId,
    name: "computer_move_mouse",
    input: {
      coordinates: action.coordinates,
    },
  };
}

export function isTraceMouseAction(obj: unknown): obj is TraceMouseAction {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const action = obj as Record<string, any>;
  return action.action === "trace_mouse";
}

export function convertTraceMouseActionToToolUseBlock(
  action: TraceMouseAction,
  toolUseId: string
): ComputerToolUseContentBlock {
  return {
    type: MessageContentType.ToolUse,
    id: toolUseId,
    name: "computer_trace_mouse",
    input: {
      path: action.path,
      ...(action.holdKeys && { holdKeys: action.holdKeys }),
    },
  };
}

export function isClickMouseAction(obj: unknown): obj is ClickMouseAction {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const action = obj as Record<string, any>;
  return action.action === "click_mouse";
}

export function convertClickMouseActionToToolUseBlock(
  action: ClickMouseAction,
  toolUseId: string
): ComputerToolUseContentBlock {
  return {
    type: MessageContentType.ToolUse,
    id: toolUseId,
    name: "computer_click_mouse",
    input: {
      ...(action.coordinates && { coordinates: action.coordinates }),
      button: action.button,
      ...(action.holdKeys && { holdKeys: action.holdKeys }),
      numClicks: action.numClicks,
    },
  };
}

export function isPressMouseAction(obj: unknown): obj is PressMouseAction {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const action = obj as Record<string, any>;
  return action.action === "press_mouse";
}

export function convertPressMouseActionToToolUseBlock(
  action: PressMouseAction,
  toolUseId: string
): ComputerToolUseContentBlock {
  return {
    type: MessageContentType.ToolUse,
    id: toolUseId,
    name: "computer_press_mouse",
    input: {
      ...(action.coordinates && { coordinates: action.coordinates }),
      button: action.button,
      press: action.press,
    },
  };
}

export function isDragMouseAction(obj: unknown): obj is DragMouseAction {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const action = obj as Record<string, any>;
  return action.action === "drag_mouse";
}

export function convertDragMouseActionToToolUseBlock(
  action: DragMouseAction,
  toolUseId: string
): ComputerToolUseContentBlock {
  return {
    type: MessageContentType.ToolUse,
    id: toolUseId,
    name: "computer_drag_mouse",
    input: {
      path: action.path,
      button: action.button,
      ...(action.holdKeys && { holdKeys: action.holdKeys }),
    },
  };
}

export function isScrollAction(obj: unknown): obj is ScrollAction {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const action = obj as Record<string, any>;
  return action.action === "scroll";
}

export function convertScrollActionToToolUseBlock(
  action: ScrollAction,
  toolUseId: string
): ComputerToolUseContentBlock {
  return {
    type: MessageContentType.ToolUse,
    id: toolUseId,
    name: "computer_scroll",
    input: {
      ...(action.coordinates && { coordinates: action.coordinates }),
      direction: action.direction,
      numScrolls: action.numScrolls,
      ...(action.holdKeys && { holdKeys: action.holdKeys }),
    },
  };
}

export function isTypeKeysAction(obj: unknown): obj is TypeKeysAction {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const action = obj as Record<string, any>;
  return action.action === "type_keys";
}

export function convertTypeKeysActionToToolUseBlock(
  action: TypeKeysAction,
  toolUseId: string
): ComputerToolUseContentBlock {
  return {
    type: MessageContentType.ToolUse,
    id: toolUseId,
    name: "computer_type_keys",
    input: {
      keys: action.keys,
      ...(typeof action.delay === "number" && { delay: action.delay }),
    },
  };
}

export function isPressKeysAction(obj: unknown): obj is PressKeysAction {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const action = obj as Record<string, any>;
  return action.action === "press_keys";
}

export function convertPressKeysActionToToolUseBlock(
  action: PressKeysAction,
  toolUseId: string
): ComputerToolUseContentBlock {
  return {
    type: MessageContentType.ToolUse,
    id: toolUseId,
    name: "computer_press_keys",
    input: {
      keys: action.keys,
      press: action.press,
    },
  };
}

export function isTypeTextAction(obj: unknown): obj is TypeTextAction {
  if (!obj || typeof obj !== "object") {
    return false;
  }

  const action = obj as Record<string, any>;
  return action.action === "type_text";
}

export function convertTypeTextActionToToolUseBlock(
  action: TypeTextAction,
  toolUseId: string
): ComputerToolUseContentBlock {
  return {
    type: MessageContentType.ToolUse,
    id: toolUseId,
    name: "computer_type_text",
    input: {
      text: action.text,
      ...(typeof action.delay === "number" && { delay: action.delay }),
      ...(typeof action.isSensitive === "boolean" && {
        isSensitive: action.isSensitive,
      }),
    },
  };
}
