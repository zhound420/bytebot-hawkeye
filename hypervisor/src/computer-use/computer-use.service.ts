import { Injectable, Logger } from '@nestjs/common';
import { QemuService } from '../qemu/qemu.service';

export type Coordinates = { x: number; y: number };
export type Button = 'left' | 'right' | 'middle';
export type Press = 'up' | 'down';
export type Axis = 'vertical' | 'horizontal';

// Define individual computer action types
export type MoveMouseAction = {
  action: 'move_mouse';
  coordinates: Coordinates;
};

export type TraceMouseAction = {
  action: 'trace_mouse';
  path: Coordinates[];
  holdKeys?: string[];
};

export type ClickMouseAction = {
  action: 'click_mouse';
  coordinates?: Coordinates;
  button: Button;
  holdKeys?: string[];
  numClicks?: number;
};

export type PressMouseAction = {
  action: 'press_mouse';
  coordinates?: Coordinates;
  button: Button;
  press: Press;
};

export type DragMouseAction = {
  action: 'drag_mouse';
  path: Coordinates[];
  button: Button;
  holdKeys?: string[];
};

export type ScrollAction = {
  action: 'scroll';
  coordinates?: Coordinates;
  axis: Axis;
  distance: number;
  holdKeys?: string[];
};

export type TypeKeysAction = {
  action: 'type_keys';
  keys: string[];
  delay?: number;
};

export type PressKeysAction = {
  action: 'press_keys';
  keys: string[];
  press: Press;
};

export type TypeTextAction = {
  action: 'type_text';
  text: string;
  delay?: number;
};

export type WaitAction = {
  action: 'wait';
  duration: number;
};

export type ScreenshotAction = {
  action: 'screenshot';
};

export type GetCursorPositionAction = {
  action: 'get_cursor_position';
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
  | GetCursorPositionAction;

@Injectable()
export class ComputerUseService {
  private readonly logger = new Logger(ComputerUseService.name);
  // Track the last known cursor position.
  private cursorPosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(private readonly qemuService: QemuService) {}

  async action(params: ComputerAction): Promise<any> {
    this.logger.log(`Executing computer action: ${params.action}`);

    switch (params.action) {
      case 'move_mouse': {
        await this.moveMouse(params as MoveMouseAction);
        break;
      }
      case 'trace_mouse': {
        await this.traceMouse(params as TraceMouseAction);
        break;
      }
      case 'click_mouse': {
        await this.clickMouse(params as ClickMouseAction);
        break;
      }
      case 'press_mouse': {
        await this.pressMouse(params as PressMouseAction);
        break;
      }
      case 'drag_mouse': {
        await this.dragMouse(params as DragMouseAction);
        break;
      }

      case 'scroll': {
        await this.scroll(params as ScrollAction);
        break;
      }
      case 'type_keys': {
        await this.typeKeys(params as TypeKeysAction);
        break;
      }
      case 'press_keys': {
        await this.pressKeys(params as PressKeysAction);
        break;
      }
      case 'type_text': {
        await this.typeText(params as TypeTextAction);
        break;
      }
      case 'wait': {
        const waitParams = params as WaitAction;
        await this.delay(waitParams.duration);
        break;
      }
      case 'screenshot':
        return this.screenshot();

      case 'get_cursor_position':
        return this.cursor_position();

      default:
        throw new Error(
          `Unsupported computer action: ${(params as any).action}`,
        );
    }
  }

  private async moveMouse(action: MoveMouseAction): Promise<void> {
    await this.qemuService.mouseMoveEvent(action.coordinates);
  }

  private async traceMouse(action: TraceMouseAction): Promise<void> {
    const { path, holdKeys } = action;

    // Move to the first coordinate
    await this.qemuService.mouseMoveEvent(path[0]);

    // Hold keys if provided
    if (holdKeys) {
      await this.qemuService.holdKeys(holdKeys, true);
    }

    // Move to each coordinate in the path
    for (const coordinates of path) {
      await this.qemuService.mouseMoveEvent(coordinates);
    }

    // Release hold keys
    if (holdKeys) {
      await this.qemuService.holdKeys(holdKeys, false);
    }
  }

  private async clickMouse(action: ClickMouseAction): Promise<void> {
    const { coordinates, button, holdKeys, numClicks } = action;

    // Move to coordinates if provided
    if (coordinates) {
      await this.qemuService.mouseMoveEvent(coordinates);
    }

    // Hold keys if provided
    if (holdKeys) {
      await this.qemuService.holdKeys(holdKeys, true);
    }

    // Perform clicks
    if (numClicks && numClicks > 1) {
      // Perform multiple clicks
      for (let i = 0; i < numClicks; i++) {
        await this.qemuService.mouseClickEvent(button);
        await this.delay(150);
      }
    } else {
      // Perform a single click
      await this.qemuService.mouseClickEvent(button);
    }

    // Release hold keys
    if (holdKeys) {
      await this.qemuService.holdKeys(holdKeys, false);
    }
  }

  private async pressMouse(action: PressMouseAction): Promise<void> {
    const { coordinates, button, press } = action;

    // Move to coordinates if provided
    if (coordinates) {
      await this.qemuService.mouseMoveEvent(coordinates);
    }

    // Perform press
    if (press === 'down') {
      await this.qemuService.mouseButtonEvent(button, true);
    } else {
      await this.qemuService.mouseButtonEvent(button, false);
    }
  }

  private async dragMouse(action: DragMouseAction): Promise<void> {
    const { path, button, holdKeys } = action;

    // Move to the first coordinate
    await this.qemuService.mouseMoveEvent(path[0]);

    // Hold keys if provided
    if (holdKeys) {
      await this.qemuService.holdKeys(holdKeys, true);
    }

    // Perform drag
    await this.qemuService.mouseButtonEvent(button, true);
    for (const coordinates of path) {
      await this.qemuService.mouseMoveEvent(coordinates);
    }
    await this.qemuService.mouseButtonEvent(button, false);

    // Release hold keys
    if (holdKeys) {
      await this.qemuService.holdKeys(holdKeys, false);
    }
  }

  private async scroll(action: ScrollAction): Promise<void> {
    const { coordinates, axis, distance, holdKeys } = action;

    // Move to coordinates if provided
    if (coordinates) {
      await this.qemuService.mouseMoveEvent(coordinates);
    }

    // Hold keys if provided
    if (holdKeys) {
      await this.qemuService.holdKeys(holdKeys, true);
    }

    // Perform scroll
    await this.qemuService.mouseWheelEvent(axis, distance);

    // Release hold keys
    if (holdKeys) {
      await this.qemuService.holdKeys(holdKeys, false);
    }
  }

  private async typeKeys(action: TypeKeysAction): Promise<void> {
    const { keys, delay } = action;
    await this.qemuService.sendKeys(keys, delay);
  }

  private async pressKeys(action: PressKeysAction): Promise<void> {
    const { keys, press } = action;
    await this.qemuService.holdKeys(keys, press === 'down');
  }

  private async typeText(action: TypeTextAction): Promise<void> {
    const { text, delay } = action;
    await this.qemuService.typeText(text, delay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async screenshot(): Promise<{ image: string }> {
    this.logger.log(`Taking screenshot`);
    const buffer = await this.qemuService.screendump();
    return { image: `${buffer.toString('base64')}` };
  }

  private async cursor_position(): Promise<{ x: number; y: number }> {
    this.logger.log(`Getting cursor position`);
    return { x: this.cursorPosition.x, y: this.cursorPosition.y };
  }
}
