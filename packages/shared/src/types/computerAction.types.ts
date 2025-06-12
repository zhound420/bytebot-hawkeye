export type Coordinates = { x: number; y: number };
export type Button = "left" | "right" | "middle";
export type Press = "up" | "down";

// Define individual computer action types
export type MoveMouseAction = {
  action: "move_mouse";
  coordinates: Coordinates;
};

export type TraceMouseAction = {
  action: "trace_mouse";
  path: Coordinates[];
  holdKeys?: string[];
};

export type ClickMouseAction = {
  action: "click_mouse";
  coordinates?: Coordinates;
  button: Button;
  holdKeys?: string[];
  numClicks: number;
};

export type PressMouseAction = {
  action: "press_mouse";
  coordinates?: Coordinates;
  button: Button;
  press: Press;
};

export type DragMouseAction = {
  action: "drag_mouse";
  path: Coordinates[];
  button: Button;
  holdKeys?: string[];
};

export type ScrollAction = {
  action: "scroll";
  coordinates?: Coordinates;
  direction: "up" | "down" | "left" | "right";
  numScrolls: number;
  holdKeys?: string[];
};

export type TypeKeysAction = {
  action: "type_keys";
  keys: string[];
  delay?: number;
};

export type PressKeysAction = {
  action: "press_keys";
  keys: string[];
  press: Press;
};

export type TypeTextAction = {
  action: "type_text";
  text: string;
  delay?: number;
  isSensitive?: boolean;
};

export type WaitAction = {
  action: "wait";
  duration: number;
};

export type ScreenshotAction = {
  action: "screenshot";
};

export type CursorPositionAction = {
  action: "cursor_position";
};

// Define the union type using the individual action types
export type ComputerAction =
  | MoveMouseAction
  | TraceMouseAction
  | ClickMouseAction
  | PressMouseAction
  | DragMouseAction
  | ScrollAction
  | TypeKeysAction
  | PressKeysAction
  | TypeTextAction
  | WaitAction
  | ScreenshotAction
  | CursorPositionAction;
