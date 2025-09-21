export type Coordinates = { x: number; y: number };
export type Button = "left" | "right" | "middle";
export type Press = "up" | "down";
export type Application =
  | "firefox"
  | "1password"
  | "thunderbird"
  | "vscode"
  | "terminal"
  | "desktop"
  | "directory";

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
  clickCount: number;
  description?: string;
  context?: ClickContext;
};

export type ActionSource =
  | "manual"
  | "smart_focus"
  | "progressive_zoom"
  | "binary_search";

export type ClickContext = {
  region?: { x: number; y: number; width: number; height: number };
  zoomLevel?: number;
  targetDescription?: string;
  source?: ActionSource;
  clickTaskId?: string;
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
  scrollCount: number;
  holdKeys?: string[];
};

export type TypeKeysAction = {
  action: "type_keys";
  keys: string[];
  delay?: number;
};

export type PasteTextAction = {
  action: "paste_text";
  text: string;
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
  sensitive?: boolean;
};

export type WaitAction = {
  action: "wait";
  duration: number;
};

export type ScreenshotAction = {
  action: "screenshot";
  gridOverlay?: boolean;
  gridSize?: number;
  highlightRegions?: boolean;
  showCursor?: boolean;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  markTarget?: {
    coordinates: Coordinates;
    label?: string;
  };
};

export type ScreenshotRegionAction = {
  action: "screenshot_region";
  region:
    | "top-left"
    | "top-center"
    | "top-right"
    | "middle-left"
    | "middle-center"
    | "middle-right"
    | "bottom-left"
    | "bottom-center"
    | "bottom-right";
  gridSize?: number;
  enhance?: boolean;
  includeOffset?: boolean;
  addHighlight?: boolean;
  showCursor?: boolean;
  zoomLevel?: number;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  source?: ActionSource;
};

export type ScreenshotCustomRegionAction = {
  action: "screenshot_custom_region";
  x: number;
  y: number;
  width: number;
  height: number;
  gridSize?: number;
  zoomLevel?: number;
  showCursor?: boolean;
  // Optional: draw a target marker within the returned image.
  // Coordinates are in GLOBAL screen space; daemon maps to local image coords.
  markTarget?: {
    coordinates: Coordinates;
    label?: string;
  };
  // Optional progress metadata for overlays/broadcasts
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  source?: ActionSource;
};

export type CursorPositionAction = {
  action: "cursor_position";
};

export type ScreenInfoAction = {
  action: "screen_info";
};

export type ApplicationAction = {
  action: "application";
  application: Application;
};

export type WriteFileAction = {
  action: "write_file";
  path: string;
  data: string; // Base64 encoded data
};

export type ReadFileAction = {
  action: "read_file";
  path: string;
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
  | PasteTextAction
  | WaitAction
  | ScreenshotAction
  | ScreenshotRegionAction
  | ScreenshotCustomRegionAction
  | CursorPositionAction
  | ScreenInfoAction
  | ApplicationAction
  | WriteFileAction
  | ReadFileAction;
