// src/nut/nut.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  keyboard,
  mouse,
  Point,
  screen,
  Key,
  Button,
  FileType,
} from '@nut-tree-fork/nut-js';
import { promises as fs } from 'fs';
import * as path from 'path';

/**
 * Enum representing key codes supported by nut-js.
 * Maps to the same structure as QKeyCode for compatibility.
 */

export const XKeySymToNutKeyMap: Record<string, Key> = {
  // Alphanumeric Keys
  grave: Key.Grave,
  '1': Key.Num1,
  '2': Key.Num2,
  '3': Key.Num3,
  '4': Key.Num4,
  '5': Key.Num5,
  '6': Key.Num6,
  '7': Key.Num7,
  '8': Key.Num8,
  '9': Key.Num9,
  '0': Key.Num0,
  minus: Key.Minus,
  equal: Key.Equal,
  q: Key.Q,
  w: Key.W,
  e: Key.E,
  r: Key.R,
  t: Key.T,
  y: Key.Y,
  u: Key.U,
  i: Key.I,
  o: Key.O,
  p: Key.P,
  bracketleft: Key.LeftBracket,
  bracketright: Key.RightBracket,
  backslash: Key.Backslash,
  a: Key.A,
  s: Key.S,
  d: Key.D,
  f: Key.F,
  g: Key.G,
  h: Key.H,
  j: Key.J,
  k: Key.K,
  l: Key.L,
  semicolon: Key.Semicolon,
  apostrophe: Key.Quote,
  z: Key.Z,
  x: Key.X,
  c: Key.C,
  v: Key.V,
  b: Key.B,
  n: Key.N,
  m: Key.M,
  comma: Key.Comma,
  period: Key.Period,
  slash: Key.Slash,
  space: Key.Space,

  // Function Keys
  Escape: Key.Escape,
  F1: Key.F1,
  F2: Key.F2,
  F3: Key.F3,
  F4: Key.F4,
  F5: Key.F5,
  F6: Key.F6,
  F7: Key.F7,
  F8: Key.F8,
  F9: Key.F9,
  F10: Key.F10,
  F11: Key.F11,
  F12: Key.F12,
  F13: Key.F13,
  F14: Key.F14,
  F15: Key.F15,
  F16: Key.F16,
  F17: Key.F17,
  F18: Key.F18,
  F19: Key.F19,
  F20: Key.F20,
  F21: Key.F21,
  F22: Key.F22,
  F23: Key.F23,
  F24: Key.F24,

  // Modifier Keys
  Shift_L: Key.LeftShift,
  Shift_R: Key.RightShift,
  Control_L: Key.LeftControl,
  Control_R: Key.RightControl,
  Super_L: Key.LeftSuper,
  Super_R: Key.RightSuper,
  Alt_L: Key.LeftAlt,
  Alt_R: Key.RightAlt,
  Meta_L: Key.LeftMeta,
  Meta_R: Key.RightMeta,

  // Lock and Toggle Keys
  Caps_Lock: Key.CapsLock,
  Num_Lock: Key.NumLock,
  Scroll_Lock: Key.ScrollLock,

  // Editing Keys
  BackSpace: Key.Backspace,
  Tab: Key.Tab,
  Return: Key.Return,
  Enter: Key.Enter,
  Insert: Key.Insert,
  Delete: Key.Delete,
  Home: Key.Home,
  End: Key.End,
  Page_Up: Key.PageUp,
  Page_Down: Key.PageDown,
  Clear: Key.Clear,

  // Cursor Movement Keys
  Left: Key.Left,
  Up: Key.Up,
  Right: Key.Right,
  Down: Key.Down,

  // Numpad Keys
  KP_0: Key.NumPad0,
  KP_1: Key.NumPad1,
  KP_2: Key.NumPad2,
  KP_3: Key.NumPad3,
  KP_4: Key.NumPad4,
  KP_5: Key.NumPad5,
  KP_6: Key.NumPad6,
  KP_7: Key.NumPad7,
  KP_8: Key.NumPad8,
  KP_9: Key.NumPad9,
  KP_Add: Key.Add,
  KP_Subtract: Key.Subtract,
  KP_Multiply: Key.Multiply,
  KP_Divide: Key.Divide,
  KP_Decimal: Key.Decimal,
  KP_Equal: Key.NumPadEqual,

  // Special System Keys
  Print: Key.Print,
  Pause: Key.Pause,
  Menu: Key.Menu,

  // Multimedia Keys
  AudioMute: Key.AudioMute,
  AudioLowerVolume: Key.AudioVolDown,
  AudioRaiseVolume: Key.AudioVolUp,
  AudioPlay: Key.AudioPlay,
  AudioStop: Key.AudioStop,
  AudioPause: Key.AudioPause,
  AudioPrev: Key.AudioPrev,
  AudioNext: Key.AudioNext,
  AudioRewind: Key.AudioRewind,
  AudioForward: Key.AudioForward,
  AudioRepeat: Key.AudioRepeat,
  AudioRandomPlay: Key.AudioRandom,
};

@Injectable()
export class NutService {
  private readonly logger = new Logger(NutService.name);
  private screenshotDir: string;

  constructor() {
    // Initialize nut-js settings
    mouse.config.autoDelayMs = 100;
    keyboard.config.autoDelayMs = 100;

    // Create screenshot directory if it doesn't exist
    this.screenshotDir = path.join('/tmp', 'bytebot-screenshots');
    fs.mkdir(this.screenshotDir, { recursive: true }).catch((err) => {
      this.logger.error(
        `Failed to create screenshot directory: ${err.message}`,
      );
    });
  }

  /**
   * Sends key events to the computer.
   *
   * @param keys An array of key strings.
   * @param delay Delay between pressing and releasing keys in ms.
   */
  async sendKeys(keys: string[], delay: number = 100): Promise<any> {
    this.logger.log(`Sending keys: ${keys}`);

    try {
      for (const key of keys) {
        const nutKey = this.validateKey(key);
        await keyboard.pressKey(nutKey);
        await this.delay(delay);
        await keyboard.releaseKey(nutKey);
      }
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to send keys: ${error.message}`);
    }
  }

  /**
   * Holds or releases keys.
   *
   * @param keys An array of key strings.
   * @param down True to press the keys down, false to release them.
   */
  async holdKeys(keys: string[], down: boolean): Promise<any> {
    try {
      for (const key of keys) {
        const nutKey = this.validateKey(key);
        if (down) {
          await keyboard.pressKey(nutKey);
        } else {
          await keyboard.releaseKey(nutKey);
        }
      }
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to hold keys: ${error.message}`);
    }
  }

  /**
   * Validates a key and returns the corresponding nut-js key.
   *
   * @param key The key to validate.
   * @returns The corresponding nut-js key.
   */
  private validateKey(key: string): Key {
    const nutKey = XKeySymToNutKeyMap[key];
    if (!nutKey) {
      throw new Error(`Invalid key: ${key}`);
    }
    return nutKey;
  }

  /**
   * Types text on the keyboard.
   *
   * @param text The text to type.
   * @param delayMs Delay between keypresses in ms.
   */
  async typeText(text: string, delayMs: number = 0): Promise<void> {
    this.logger.log(`Typing text: ${text}`);

    try {
      if (delayMs > 0) {
        // Type with delay between characters
        for (const char of text) {
          await keyboard.type(char);
          await this.delay(delayMs);
        }
      } else {
        // Type all at once
        await keyboard.type(text);
      }
    } catch (error) {
      throw new Error(`Failed to type text: ${error.message}`);
    }
  }

  /**
   * Moves the mouse to specified coordinates.
   *
   * @param coordinates The x and y coordinates.
   */
  async mouseMoveEvent({ x, y }: { x: number; y: number }): Promise<any> {
    this.logger.log(`Moving mouse to coordinates: (${x}, ${y})`);
    try {
      const point = new Point(x, y);
      await mouse.setPosition(point);
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to move mouse: ${error.message}`);
    }
  }

  async mouseClickEvent(button: 'left' | 'right' | 'middle'): Promise<any> {
    this.logger.log(`Clicking mouse button: ${button}`);
    try {
      switch (button) {
        case 'left':
          await mouse.click(Button.LEFT);
          break;
        case 'right':
          await mouse.click(Button.RIGHT);
          break;
        case 'middle':
          await mouse.click(Button.MIDDLE);
          break;
      }
      return { success: true };
    } catch (error) {
      throw new Error(`Failed to click mouse button: ${error.message}`);
    }
  }

  /**
   * Presses or releases a mouse button.
   *
   * @param button The mouse button ('left', 'right', or 'middle').
   * @param pressed True to press, false to release.
   */
  async mouseButtonEvent(
    button: 'left' | 'right' | 'middle',
    pressed: boolean,
  ): Promise<any> {
    this.logger.log(
      `Mouse button event: ${button} ${pressed ? 'pressed' : 'released'}`,
    );
    try {
      if (pressed) {
        switch (button) {
          case 'left':
            await mouse.pressButton(Button.LEFT);
            break;
          case 'right':
            await mouse.pressButton(Button.RIGHT);
            break;
          case 'middle':
            await mouse.pressButton(Button.MIDDLE);
            break;
        }
      } else {
        switch (button) {
          case 'left':
            await mouse.releaseButton(Button.LEFT);
            break;
          case 'right':
            await mouse.releaseButton(Button.RIGHT);
            break;
          case 'middle':
            await mouse.releaseButton(Button.MIDDLE);
            break;
        }
      }
      return { success: true };
    } catch (error) {
      throw new Error(
        `Failed to send mouse ${button} button ${pressed ? 'press' : 'release'} event: ${error.message}`,
      );
    }
  }

  /**
   * Scrolls the mouse wheel.
   *
   * @param direction The scroll direction ('up', 'down', 'left', or 'right').
   * @param amount The number of scroll steps.
   */
  async mouseWheelEvent(
    direction: 'right' | 'left' | 'up' | 'down',
    amount: number,
  ): Promise<any> {
    this.logger.log(`Mouse wheel event: ${direction} ${amount}`);
    try {
      switch (direction) {
        case 'up':
          await mouse.scrollUp(amount);
          break;
        case 'down':
          await mouse.scrollDown(amount);
          break;
        case 'left':
          await mouse.scrollLeft(amount);
          break;
        case 'right':
          await mouse.scrollRight(amount);
          break;
      }

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to scroll: ${error.message}`);
    }
  }

  /**
   * Takes a screenshot of the screen.
   *
   * @returns A Promise that resolves with a Buffer containing the image.
   */
  async screendump(): Promise<Buffer> {
    const filename = `screenshot-${Date.now()}.png`;
    const filepath = path.join(this.screenshotDir, filename);
    this.logger.log(`Taking screenshot to ${filepath}`);

    try {
      // Take screenshot
      await screen.capture(filename, FileType.PNG, this.screenshotDir);

      // Read the file back and return as buffer
      return await fs.readFile(filepath);
    } catch (error) {
      this.logger.error(`Error taking screenshot: ${error.message}`);
      throw error;
    } finally {
      // Clean up the temporary file
      try {
        await fs.unlink(filepath);
      } catch (unlinkError) {
        // Ignore if file doesn't exist
        this.logger.warn(
          `Failed to remove temporary screenshot file: ${unlinkError.message}`,
        );
      }
    }
  }

  async getCursorPosition(): Promise<{ x: number; y: number }> {
    this.logger.log(`Getting cursor position`);
    try {
      const position = await mouse.getPosition();
      return { x: position.x, y: position.y };
    } catch (error) {
      this.logger.error(`Error getting cursor position: ${error.message}`);
      throw error;
    }
  }

  /**
   * Utility method to create a delay.
   *
   * @param ms Milliseconds to wait
   */
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
