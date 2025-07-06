import { Injectable, Logger } from '@nestjs/common';
import { NutService } from '../nut/nut.service';
import {
  ComputerAction,
  Coordinates,
  Button,
  Press,
  MoveMouseAction,
  TraceMouseAction,
  ClickMouseAction,
  PressMouseAction,
  DragMouseAction,
  ScrollAction,
  TypeKeysAction,
  PressKeysAction,
  TypeTextAction,
  WaitAction,
} from '@bytebot/shared';

@Injectable()
export class ComputerUseService {
  private readonly logger = new Logger(ComputerUseService.name);

  constructor(private readonly nutService: NutService) {}

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

      case 'cursor_position':
        return this.cursor_position();

      default:
        throw new Error(
          `Unsupported computer action: ${(params as any).action}`,
        );
    }
  }

  private async moveMouse(action: MoveMouseAction): Promise<void> {
    await this.nutService.mouseMoveEvent(action.coordinates);
  }

  private async traceMouse(action: TraceMouseAction): Promise<void> {
    const { path, holdKeys } = action;

    // Move to the first coordinate
    await this.nutService.mouseMoveEvent(path[0]);

    // Hold keys if provided
    if (holdKeys) {
      await this.nutService.holdKeys(holdKeys, true);
    }

    // Move to each coordinate in the path
    for (const coordinates of path) {
      await this.nutService.mouseMoveEvent(coordinates);
    }

    // Release hold keys
    if (holdKeys) {
      await this.nutService.holdKeys(holdKeys, false);
    }
  }

  private async clickMouse(action: ClickMouseAction): Promise<void> {
    const { coordinates, button, holdKeys, clickCount } = action;

    // Move to coordinates if provided
    if (coordinates) {
      await this.nutService.mouseMoveEvent(coordinates);
    }

    // Hold keys if provided
    if (holdKeys) {
      await this.nutService.holdKeys(holdKeys, true);
    }

    // Perform clicks
    if (clickCount > 1) {
      // Perform multiple clicks
      for (let i = 0; i < clickCount; i++) {
        await this.nutService.mouseClickEvent(button);
        await this.delay(150);
      }
    } else {
      // Perform a single click
      await this.nutService.mouseClickEvent(button);
    }

    // Release hold keys
    if (holdKeys) {
      await this.nutService.holdKeys(holdKeys, false);
    }
  }

  private async pressMouse(action: PressMouseAction): Promise<void> {
    const { coordinates, button, press } = action;

    // Move to coordinates if provided
    if (coordinates) {
      await this.nutService.mouseMoveEvent(coordinates);
    }

    // Perform press
    if (press === 'down') {
      await this.nutService.mouseButtonEvent(button, true);
    } else {
      await this.nutService.mouseButtonEvent(button, false);
    }
  }

  private async dragMouse(action: DragMouseAction): Promise<void> {
    const { path, button, holdKeys } = action;

    // Move to the first coordinate
    await this.nutService.mouseMoveEvent(path[0]);

    // Hold keys if provided
    if (holdKeys) {
      await this.nutService.holdKeys(holdKeys, true);
    }

    // Perform drag
    await this.nutService.mouseButtonEvent(button, true);
    for (const coordinates of path) {
      await this.nutService.mouseMoveEvent(coordinates);
    }
    await this.nutService.mouseButtonEvent(button, false);

    // Release hold keys
    if (holdKeys) {
      await this.nutService.holdKeys(holdKeys, false);
    }
  }

  private async scroll(action: ScrollAction): Promise<void> {
    const { coordinates, direction, scrollCount, holdKeys } = action;

    // Move to coordinates if provided
    if (coordinates) {
      await this.nutService.mouseMoveEvent(coordinates);
    }

    // Hold keys if provided
    if (holdKeys) {
      await this.nutService.holdKeys(holdKeys, true);
    }

    // Perform scroll
    for (let i = 0; i < scrollCount; i++) {
      await this.nutService.mouseWheelEvent(direction, 1);
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    // Release hold keys
    if (holdKeys) {
      await this.nutService.holdKeys(holdKeys, false);
    }
  }

  private async typeKeys(action: TypeKeysAction): Promise<void> {
    const { keys, delay } = action;
    await this.nutService.sendKeys(keys, delay);
  }

  private async pressKeys(action: PressKeysAction): Promise<void> {
    const { keys, press } = action;
    await this.nutService.holdKeys(keys, press === 'down');
  }

  private async typeText(action: TypeTextAction): Promise<void> {
    const { text, delay } = action;
    await this.nutService.typeText(text, delay);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async screenshot(): Promise<{ image: string }> {
    this.logger.log(`Taking screenshot`);
    const buffer = await this.nutService.screendump();
    return { image: `${buffer.toString('base64')}` };
  }

  private async cursor_position(): Promise<{ x: number; y: number }> {
    this.logger.log(`Getting cursor position`);
    return await this.nutService.getCursorPosition();
  }
}
