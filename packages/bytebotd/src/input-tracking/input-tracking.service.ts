import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  uIOhook,
  UiohookKeyboardEvent,
  UiohookMouseEvent,
  UiohookWheelEvent,
  UiohookKey,
  WheelDirection,
} from 'uiohook-napi';
import {
  Button,
  ClickMouseAction,
  ComputerAction,
  ComputerUseService,
  DragMouseAction,
  PressKeysAction,
  ScrollAction,
  TypeKeysAction,
} from '../computer-use/computer-use.service';
import { InputTrackingGateway } from './input-tracking.gateway';

@Injectable()
export class InputTrackingService implements OnModuleDestroy {
  private readonly logger = new Logger(InputTrackingService.name);

  private isTracking = false;

  private isDragging = false;
  private dragMouseAction: DragMouseAction | null = null;

  private scrollAction: ScrollAction | null = null;
  private scrollCount = 0;

  private clickMouseActionBuffer: ClickMouseAction[] = [];
  private clickMouseActionTimeout: NodeJS.Timeout | null = null;

  private screenshot: { image: string } | null = null;
  private screenshotTimeout: NodeJS.Timeout | null = null;

  private: string[] = [];
  private keyTimeout: NodeJS.Timeout | null = null;

  constructor(
    private readonly gateway: InputTrackingGateway,
    private readonly computerUseService: ComputerUseService,
  ) {}

  // Tracking is started manually via startTracking

  onModuleDestroy() {
    this.stopTracking();
  }

  startTracking() {
    if (this.isTracking) {
      return;
    }
    this.logger.log('Starting input tracking');
    this.registerListeners();
    uIOhook.start();
    this.isTracking = true;
  }

  stopTracking() {
    if (!this.isTracking) {
      return;
    }
    this.logger.log('Stopping input tracking');
    uIOhook.stop();
    uIOhook.removeAllListeners();
    this.isTracking = false;
  }

  private registerListeners() {
    uIOhook.on('mousemove', (e: UiohookMouseEvent) => {
      if (this.isDragging && this.dragMouseAction) {
        this.dragMouseAction.path.push({ x: e.x, y: e.y });
      } else {
        if (this.screenshotTimeout) {
          clearTimeout(this.screenshotTimeout);
        }
        this.screenshotTimeout = setTimeout(async () => {
          this.screenshot = await this.computerUseService.screenshot();
        }, 25);
      }
    });

    uIOhook.on('click', (e: UiohookMouseEvent) => {
      const action: ClickMouseAction = {
        action: 'click_mouse',
        button: this.mapButton(e.button),
        coordinates: { x: e.x, y: e.y },
        numClicks: e.clicks,
        holdKeys: [
          e.altKey ? 'alt' : undefined,
          e.ctrlKey ? 'ctrl' : undefined,
          e.shiftKey ? 'shift' : undefined,
          e.metaKey ? 'meta' : undefined,
        ].filter((key) => key !== undefined),
      };
      this.clickMouseActionBuffer.push(action);
      if (this.clickMouseActionTimeout) {
        clearTimeout(this.clickMouseActionTimeout);
      }
      this.clickMouseActionTimeout = setTimeout(() => {
        if (this.clickMouseActionBuffer.length === 1) {
          this.logAction(this.clickMouseActionBuffer[0]);
        }

        if (this.clickMouseActionBuffer.length > 1) {
          this.clickMouseActionBuffer.forEach((action) => {
            // Skip single click actions
            if (action.numClicks > 1) {
              this.logAction(action);
            }
          });
        }
        this.clickMouseActionTimeout = null;
        this.clickMouseActionBuffer = [];
      }, 100);
    });

    uIOhook.on('mousedown', (e: UiohookMouseEvent) => {
      this.isDragging = true;
      this.dragMouseAction = {
        action: 'drag_mouse',
        button: this.mapButton(e.button),
        path: [{ x: e.x, y: e.y }],
        holdKeys: [
          e.altKey ? 'alt' : undefined,
          e.ctrlKey ? 'ctrl' : undefined,
          e.shiftKey ? 'shift' : undefined,
          e.metaKey ? 'meta' : undefined,
        ].filter((key) => key !== undefined),
      };
    });

    uIOhook.on('mouseup', (e: UiohookMouseEvent) => {
      if (this.isDragging && this.dragMouseAction) {
        this.dragMouseAction.path.push({ x: e.x, y: e.y });
        if (this.dragMouseAction.path.length > 3) {
          this.logAction(this.dragMouseAction);
        }
        this.dragMouseAction = null;
      }
      this.isDragging = false;
    });

    uIOhook.on('wheel', (e: UiohookWheelEvent) => {
      const direction =
        e.direction === WheelDirection.VERTICAL
          ? e.rotation > 0
            ? 'down'
            : 'up'
          : e.rotation > 0
            ? 'right'
            : 'left';
      const action: ScrollAction = {
        action: 'scroll',
        direction: direction as any,
        numScrolls: Math.abs(e.rotation),
        coordinates: { x: e.x, y: e.y },
      };

      if (
        this.scrollAction &&
        action.direction === this.scrollAction.direction
      ) {
        this.scrollCount++;
        if (this.scrollCount >= 4) {
          this.logAction(this.scrollAction);
          this.scrollAction = null;
          this.scrollCount = 0;
        }
      } else {
        this.scrollAction = action;
        this.scrollCount = 1;
      }
    });

    uIOhook.on('keydown', (e: UiohookKeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.shiftKey || e.metaKey) {
        const action: PressKeysAction = {
          action: 'press_keys',
          keys: [
            e.altKey ? 'alt' : undefined,
            e.ctrlKey ? 'ctrl' : undefined,
            e.shiftKey ? 'shift' : undefined,
            e.metaKey ? 'meta' : undefined,
            this.keyToString(e.keycode),
          ].filter((key) => key !== undefined),
          press: 'down',
        };
        this.logAction(action);
      }
    });

    uIOhook.on('keyup', (e: any) => {
      const action: PressKeysAction = {
        action: 'press_keys',
        keys: [
          e.altKey ? 'alt' : undefined,
          e.ctrlKey ? 'ctrl' : undefined,
          e.shiftKey ? 'shift' : undefined,
          e.metaKey ? 'meta' : undefined,
          this.keyToString(e.keycode),
        ].filter((key) => key !== undefined),
        press: 'up',
      };
      this.logAction(action);
    });
  }

  private mapButton(btn: unknown): Button {
    switch (btn) {
      case 1:
        return 'left';
      case 2:
        return 'right';
      case 3:
        return 'middle';
      default:
        return 'left';
    }
  }

  private uiohookKeyToStringMap: Record<number, string> = {
    [UiohookKey.Backspace]: 'Backspace',
    [UiohookKey.Tab]: 'Tab',
    [UiohookKey.Enter]: 'Enter',
    [UiohookKey.CapsLock]: 'CapsLock',
    [UiohookKey.Escape]: 'Escape',
    [UiohookKey.Space]: 'Space',
    [UiohookKey.PageUp]: 'PageUp',
    [UiohookKey.PageDown]: 'PageDown',
    [UiohookKey.End]: 'End',
    [UiohookKey.Home]: 'Home',
    [UiohookKey.ArrowLeft]: 'Left',
    [UiohookKey.ArrowUp]: 'Up',
    [UiohookKey.ArrowRight]: 'Right',
    [UiohookKey.ArrowDown]: 'Down',
    [UiohookKey.Insert]: 'Insert',
    [UiohookKey.Delete]: 'Delete',

    // // Numpad Keys
    [UiohookKey.Numpad0]: 'NumPad0',
    [UiohookKey.Numpad1]: 'NumPad1',
    [UiohookKey.Numpad2]: 'NumPad2',
    [UiohookKey.Numpad3]: 'NumPad3',
    [UiohookKey.Numpad4]: 'NumPad4',
    [UiohookKey.Numpad5]: 'NumPad5',
    [UiohookKey.Numpad6]: 'NumPad6',
    [UiohookKey.Numpad7]: 'NumPad7',
    [UiohookKey.Numpad8]: 'NumPad8',
    [UiohookKey.Numpad9]: 'NumPad9',

    [UiohookKey.NumpadMultiply]: 'Multiply',
    [UiohookKey.NumpadAdd]: 'Add',
    [UiohookKey.NumpadSubtract]: 'Subtract',
    [UiohookKey.NumpadDecimal]: 'Decimal',
    [UiohookKey.NumpadDivide]: 'Divide',
    [UiohookKey.NumpadEnter]: 'Enter',
    [UiohookKey.NumpadEnd]: 'End',
    [UiohookKey.NumpadArrowDown]: 'Down',
    [UiohookKey.NumpadPageDown]: 'PageDown',
    [UiohookKey.NumpadArrowLeft]: 'Left',
    [UiohookKey.NumpadArrowRight]: 'Right',
    [UiohookKey.NumpadHome]: 'Home',
    [UiohookKey.NumpadArrowUp]: 'Up',
    [UiohookKey.NumpadPageUp]: 'PageUp',
    [UiohookKey.NumpadInsert]: 'Insert',
    [UiohookKey.NumpadDelete]: 'Delete',

    // Function Keys
    [UiohookKey.F1]: 'F1',
    [UiohookKey.F2]: 'F2',
    [UiohookKey.F3]: 'F3',
    [UiohookKey.F4]: 'F4',
    [UiohookKey.F5]: 'F5',
    [UiohookKey.F6]: 'F6',
    [UiohookKey.F7]: 'F7',
    [UiohookKey.F8]: 'F8',
    [UiohookKey.F9]: 'F9',
    [UiohookKey.F10]: 'F10',
    [UiohookKey.F11]: 'F11',
    [UiohookKey.F12]: 'F12',
    [UiohookKey.F13]: 'F13',
    [UiohookKey.F14]: 'F14',
    [UiohookKey.F15]: 'F15',
    [UiohookKey.F16]: 'F16',
    [UiohookKey.F17]: 'F17',
    [UiohookKey.F18]: 'F18',
    [UiohookKey.F19]: 'F19',
    [UiohookKey.F20]: 'F20',
    [UiohookKey.F21]: 'F21',
    [UiohookKey.F22]: 'F22',
    [UiohookKey.F23]: 'F23',
    [UiohookKey.F24]: 'F24',

    [UiohookKey.Semicolon]: 'Semicolon',
    [UiohookKey.Equal]: 'Equal',
    [UiohookKey.Comma]: 'Comma',
    [UiohookKey.Minus]: 'Minus',
    [UiohookKey.Period]: 'Period',
    [UiohookKey.Slash]: 'Slash',
    [UiohookKey.Backquote]: 'Grave',
    [UiohookKey.BracketLeft]: 'LeftBracket',
    [UiohookKey.Backslash]: 'Backslash',
    [UiohookKey.BracketRight]: 'RightBracket',
    [UiohookKey.Quote]: 'Quote',
    [UiohookKey.Ctrl]: 'LeftControl',
    [UiohookKey.CtrlRight]: 'RightControl',
    [UiohookKey.Alt]: 'LeftAlt',
    [UiohookKey.AltRight]: 'RightAlt',
    [UiohookKey.Meta]: 'LeftMeta',
    [UiohookKey.MetaRight]: 'RightMeta',
    [UiohookKey.NumLock]: 'NumLock',
    [UiohookKey.ScrollLock]: 'ScrollLock',
    [UiohookKey.PrintScreen]: 'Print',

    [UiohookKey.A]: 'A',
    [UiohookKey.B]: 'B',
    [UiohookKey.C]: 'C',
    [UiohookKey.D]: 'D',
    [UiohookKey.E]: 'E',
    [UiohookKey.F]: 'F',
    [UiohookKey.G]: 'G',
    [UiohookKey.H]: 'H',
    [UiohookKey.I]: 'I',
    [UiohookKey.J]: 'J',
    [UiohookKey.K]: 'K',
    [UiohookKey.L]: 'L',
    [UiohookKey.M]: 'M',
    [UiohookKey.N]: 'N',
    [UiohookKey.O]: 'O',
    [UiohookKey.P]: 'P',
    [UiohookKey.Q]: 'Q',
    [UiohookKey.R]: 'R',
    [UiohookKey.S]: 'S',
    [UiohookKey.T]: 'T',
    [UiohookKey.U]: 'U',
    [UiohookKey.V]: 'V',
    [UiohookKey.W]: 'W',
    [UiohookKey.X]: 'X',
    [UiohookKey.Y]: 'Y',
    [UiohookKey.Z]: 'Z',
  };

  private keyToString(keycode: number): string {
    switch (keycode) {
      case UiohookKey[0]:
        return '0';
      case UiohookKey[1]:
        return '1';
      case UiohookKey[2]:
        return '2';
      case UiohookKey[3]:
        return '3';
      case UiohookKey[4]:
        return '4';
      case UiohookKey[5]:
        return '5';
      case UiohookKey[6]:
        return '6';
      case UiohookKey[7]:
        return '7';
      case UiohookKey[8]:
        return '8';
      case UiohookKey[9]:
        return '9';

      default:
        return this.uiohookKeyToStringMap[keycode] || 'undefined';
    }
  }

  private logAction(action: ComputerAction) {
    this.logger.log(`Detected action: ${JSON.stringify(action)}`);

    if (this.screenshot) {
      this.gateway.emitScreenshot(this.screenshot);
    }
    // wait for 50ms
    setTimeout(() => {
      this.gateway.emitAction(action);
    }, 50);
  }
}
