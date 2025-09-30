import {
  Camera01Icon,
  User03Icon,
  Cursor02Icon,
  TypeCursorIcon,
  MouseRightClick06Icon,
  TimeQuarter02Icon,
  BrowserIcon,
  FilePasteIcon,
  FileIcon,
} from "@hugeicons/core-free-icons";
import {
  ComputerToolUseContentBlock,
  isScreenshotToolUseBlock,
  isScreenshotRegionToolUseBlock,
  isScreenshotCustomRegionToolUseBlock,
  isWaitToolUseBlock,
  isTypeKeysToolUseBlock,
  isTypeTextToolUseBlock,
  isPressKeysToolUseBlock,
  isMoveMouseToolUseBlock,
  isScrollToolUseBlock,
  isCursorPositionToolUseBlock,
  isClickMouseToolUseBlock,
  isDragMouseToolUseBlock,
  isPressMouseToolUseBlock,
  isTraceMouseToolUseBlock,
  isApplicationToolUseBlock,
  isPasteTextToolUseBlock,
  isReadFileToolUseBlock,
  isWriteFileToolUseBlock,
  isComputerDetectElementsToolUseBlock,
  isComputerClickElementToolUseBlock,
  isSetTaskStatusToolUseBlock,
  isCreateTaskToolUseBlock,
} from "@bytebot/shared";
import { isScreenInfoToolUseBlock } from "@bytebot/shared";

// Define the IconType for proper type checking
export type IconType =
  | typeof Camera01Icon
  | typeof User03Icon
  | typeof Cursor02Icon
  | typeof TypeCursorIcon
  | typeof MouseRightClick06Icon
  | typeof TimeQuarter02Icon
  | typeof BrowserIcon
  | typeof FilePasteIcon
  | typeof FileIcon;

export function getIcon(block: ComputerToolUseContentBlock): IconType {
  if (isScreenshotToolUseBlock(block)) {
    return Camera01Icon;
  }
  if (isScreenshotRegionToolUseBlock(block) || isScreenshotCustomRegionToolUseBlock(block)) {
    return Camera01Icon;
  }

  if (isScreenInfoToolUseBlock(block)) {
    return User03Icon;
  }

  if (isWaitToolUseBlock(block)) {
    return TimeQuarter02Icon;
  }

  if (
    isTypeKeysToolUseBlock(block) ||
    isTypeTextToolUseBlock(block) ||
    isPressKeysToolUseBlock(block)
  ) {
    return TypeCursorIcon;
  }

  if (isPasteTextToolUseBlock(block)) {
    return FilePasteIcon;
  }

  if (isComputerDetectElementsToolUseBlock(block)) {
    return BrowserIcon;
  }

  if (isComputerClickElementToolUseBlock(block)) {
    return Cursor02Icon;
  }

  if (
    isMoveMouseToolUseBlock(block) ||
    isScrollToolUseBlock(block) ||
    isCursorPositionToolUseBlock(block) ||
    isClickMouseToolUseBlock(block) ||
    isDragMouseToolUseBlock(block) ||
    isPressMouseToolUseBlock(block) ||
    isTraceMouseToolUseBlock(block)
  ) {
    if (block.input.button === "right") {
      return MouseRightClick06Icon;
    }

    return Cursor02Icon;
  }

  if (isApplicationToolUseBlock(block)) {
    return BrowserIcon;
  }

  if (isSetTaskStatusToolUseBlock(block) || isCreateTaskToolUseBlock(block)) {
    return FileIcon;
  }

  if (isReadFileToolUseBlock(block)) {
    return FileIcon;
  }

  if (isWriteFileToolUseBlock(block)) {
    return FileIcon;
  }

  return User03Icon;
}

export function getLabel(block: ComputerToolUseContentBlock) {
  if (isScreenshotToolUseBlock(block)) {
    return "Screenshot";
  }
  if (isScreenshotRegionToolUseBlock(block)) {
    return "Region Screenshot";
  }
  if (isScreenshotCustomRegionToolUseBlock(block)) {
    return "Custom Region Screenshot";
  }

  if (isScreenInfoToolUseBlock(block)) {
    return "Screen Info";
  }

  if (isWaitToolUseBlock(block)) {
    return "Wait";
  }

  if (isTypeKeysToolUseBlock(block)) {
    return "Keys";
  }

  if (isTypeTextToolUseBlock(block)) {
    return "Type";
  }

  if (isPasteTextToolUseBlock(block)) {
    return "Paste";
  }

  if (isPressKeysToolUseBlock(block)) {
    return "Press Keys";
  }

  if (isMoveMouseToolUseBlock(block)) {
    return "Move Mouse";
  }

  if (isScrollToolUseBlock(block)) {
    return "Scroll";
  }

  if (isCursorPositionToolUseBlock(block)) {
    return "Cursor Position";
  }

  if (isClickMouseToolUseBlock(block)) {
    const button = block.input.button;
    if (button === "left") {
      if (block.input.clickCount === 2) {
        return "Double Click";
      }

      if (block.input.clickCount === 3) {
        return "Triple Click";
      }

      return "Click";
    }

    return `${block.input.button?.charAt(0).toUpperCase() + block.input.button?.slice(1)} Click`;
  }

  if (isDragMouseToolUseBlock(block)) {
    return "Drag";
  }

  if (isPressMouseToolUseBlock(block)) {
    return "Press Mouse";
  }

  if (isTraceMouseToolUseBlock(block)) {
    return "Trace Mouse";
  }

  if (isComputerDetectElementsToolUseBlock(block)) {
    return "Detect Elements";
  }

  if (isComputerClickElementToolUseBlock(block)) {
    return "Click Element";
  }

  if (isApplicationToolUseBlock(block)) {
    return "Open Application";
  }

  if (isSetTaskStatusToolUseBlock(block)) {
    return "Set Task Status";
  }

  if (isCreateTaskToolUseBlock(block)) {
    return "Create Task";
  }

  if (isReadFileToolUseBlock(block)) {
    return "Read File";
  }

  if (isWriteFileToolUseBlock(block)) {
    return "Write File";
  }

  return "Unknown";
}
