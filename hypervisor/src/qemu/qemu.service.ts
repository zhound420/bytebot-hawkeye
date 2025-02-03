// src/qemu/qemu.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { QmpClientService } from './qmp-client.service';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Enum representing QEMU key codes as defined in the QMP reference.
 * Reference: https://qemu-project.gitlab.io/qemu/interop/qemu-qmp-ref.html#qapidoc-1675
 */
export enum QKeyCode {
  // Control keys
  ESC = 'esc',
  BACKSPACE = 'backspace',
  TAB = 'tab',
  RETURN = 'ret',
  ENTER = 'ret',
  CAPS_LOCK = 'caps_lock',
  LEFT_SHIFT = 'shift',
  RIGHT_SHIFT = 'shift_r',
  LEFT_CTRL = 'ctrl',
  RIGHT_CTRL = 'ctrl_r',
  LEFT_ALT = 'alt',
  RIGHT_ALT = 'alt_r',
  LEFT_META = 'meta_l',
  RIGHT_META = 'meta_r',
  SPACE = 'spc',
  INSERT = 'insert',
  DELETE = 'delete',
  HOME = 'home',
  END = 'end',
  PAGE_UP = 'pgup',
  PAGE_DOWN = 'pgdn',

  // Arrow keys
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',

  // Function keys
  F1 = 'f1',
  F2 = 'f2',
  F3 = 'f3',
  F4 = 'f4',
  F5 = 'f5',
  F6 = 'f6',
  F7 = 'f7',
  F8 = 'f8',
  F9 = 'f9',
  F10 = 'f10',
  F11 = 'f11',
  F12 = 'f12',

  // Numeric keys
  NUM_0 = '0',
  NUM_1 = '1',
  NUM_2 = '2',
  NUM_3 = '3',
  NUM_4 = '4',
  NUM_5 = '5',
  NUM_6 = '6',
  NUM_7 = '7',
  NUM_8 = '8',
  NUM_9 = '9',

  // Alphabetic keys
  A = 'a',
  B = 'b',
  C = 'c',
  D = 'd',
  E = 'e',
  F = 'f',
  G = 'g',
  H = 'h',
  I = 'i',
  J = 'j',
  K = 'k',
  L = 'l',
  M = 'm',
  N = 'n',
  O = 'o',
  P = 'p',
  Q = 'q',
  R = 'r',
  S = 's',
  T = 't',
  U = 'u',
  V = 'v',
  W = 'w',
  X = 'x',
  Y = 'y',
  Z = 'z',

  // Symbol keys
  GRAVE = 'grave_accent',
  MINUS = 'minus',
  EQUAL = 'equal',
  BRACKET_LEFT = 'bracket_left',
  BRACKET_RIGHT = 'bracket_right',
  BACKSLASH = 'backslash',
  SEMICOLON = 'semicolon',
  APOSTROPHE = 'apostrophe',
  COMMA = 'comma',
  DOT = 'dot',
  SLASH = 'slash',
}

@Injectable()
export class QemuService {
  private readonly logger = new Logger(QemuService.name);

  constructor(private readonly qmpClient: QmpClientService) {}

  /**
   * Captures a screenshot from QEMU by instructing it to save a PNG file to a temporary location.
   * The PNG file is then read and the temporary file is deleted.
   *
   * @returns A Promise that resolves with a Buffer containing the PNG image.
   */
  async screendump(): Promise<Buffer> {
    // Generate a unique temporary filename for the PNG file.
    const tmpFile = path.join(
      os.tmpdir(),
      `screendump-${Date.now()}-${Math.floor(Math.random() * 10000)}.png`,
    );
    this.logger.log(
      `Taking screendump and saving to temporary file: ${tmpFile}`,
    );

    // Issue the QMP command to generate the screenshot (in PNG format).
    await this.qmpClient.sendCommand({
      execute: 'screendump',
      arguments: { filename: tmpFile },
    });

    let screenshotBuffer: Buffer;
    try {
      // Read the PNG file into memory.
      screenshotBuffer = await fs.readFile(tmpFile);
    } catch (error) {
      this.logger.error(
        `Error reading temporary screenshot file: ${error.message}`,
      );
      throw error;
    } finally {
      // Clean up the temporary file regardless of success.
      try {
        await fs.unlink(tmpFile);
      } catch (unlinkError) {
        this.logger.warn(
          `Failed to remove temporary screenshot file ${tmpFile}: ${unlinkError.message}`,
        );
      }
    }

    return screenshotBuffer;
  }

  /**
   * Sends key events (e.g., "ctrl-alt-delete") to the VM.
   *
   * @param key A string representing the key events.
   */
  async sendKey(key: string): Promise<any> {
    this.logger.log(`Sending key: ${key}`);
    const command = {
      execute: 'send-key',
      arguments: {
        keys: [{ type: 'qcode', data: key }],
      },
    };
    try {
      return await this.qmpClient.sendCommand(command);
    } catch (error) {
      throw new Error(`Failed to send key '${key}': ${error.message}`);
    }
  }

  /**
   * Sends a sequence of key presses to the VM.
   *
   * @param keys An array of QKeyCode values to send in sequence.
   * @param delayMs Optional delay between key presses in milliseconds.
   */
  async sendKeys(keys: QKeyCode[], delayMs: number = 0): Promise<void> {
    this.logger.log(`Sending key sequence: ${keys.join(', ')}`);

    for (const key of keys) {
      await this.sendKey(key);

      if (delayMs > 0 && keys.indexOf(key) < keys.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Translates a string into a sequence of key presses and sends them to the VM.
   *
   * @param text The text to type into the VM.
   * @param delayMs Optional delay between key presses in milliseconds.
   */
  async typeText(text: string, delayMs: number = 0): Promise<void> {
    this.logger.log(`Typing text: ${text}`);

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const keyInfo = this.charToKeyInfo(char);

      if (keyInfo) {
        if (keyInfo.withShift) {
          // Press shift key
          await this.sendKey(QKeyCode.LEFT_SHIFT);
          // Press the character key
          await this.sendKey(keyInfo.keyCode);
          // Release shift key
          await this.sendKey(QKeyCode.LEFT_SHIFT);
        } else {
          await this.sendKey(keyInfo.keyCode);
        }

        if (delayMs > 0 && i < text.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      } else {
        throw new Error(`No key mapping found for character: ${char}`);
      }
    }
  }

  /**
   * Converts a character to its corresponding key information.
   *
   * @param char The character to convert.
   * @returns An object containing the keyCode and whether shift is needed, or null if no mapping exists.
   */
  private charToKeyInfo(
    char: string,
  ): { keyCode: string; withShift: boolean } | null {
    // Handle lowercase letters
    if (/^[a-z]$/.test(char)) {
      return { keyCode: char, withShift: false };
    }

    // Handle uppercase letters (need to send shift + lowercase)
    if (/^[A-Z]$/.test(char)) {
      return { keyCode: char.toLowerCase(), withShift: true };
    }

    // Handle numbers
    if (/^[0-9]$/.test(char)) {
      return { keyCode: char, withShift: false };
    }

    // Handle special characters
    const specialCharMap: Record<
      string,
      { keyCode: string; withShift: boolean }
    > = {
      ' ': { keyCode: QKeyCode.SPACE, withShift: false },
      '.': { keyCode: QKeyCode.DOT, withShift: false },
      ',': { keyCode: QKeyCode.COMMA, withShift: false },
      ';': { keyCode: QKeyCode.SEMICOLON, withShift: false },
      "'": { keyCode: QKeyCode.APOSTROPHE, withShift: false },
      '`': { keyCode: QKeyCode.GRAVE, withShift: false },
      '-': { keyCode: QKeyCode.MINUS, withShift: false },
      '=': { keyCode: QKeyCode.EQUAL, withShift: false },
      '[': { keyCode: QKeyCode.BRACKET_LEFT, withShift: false },
      ']': { keyCode: QKeyCode.BRACKET_RIGHT, withShift: false },
      '\\': { keyCode: QKeyCode.BACKSLASH, withShift: false },
      '/': { keyCode: QKeyCode.SLASH, withShift: false },

      // Characters that require shift
      '!': { keyCode: '1', withShift: true },
      '@': { keyCode: '2', withShift: true },
      '#': { keyCode: '3', withShift: true },
      $: { keyCode: '4', withShift: true },
      '%': { keyCode: '5', withShift: true },
      '^': { keyCode: '6', withShift: true },
      '&': { keyCode: '7', withShift: true },
      '*': { keyCode: '8', withShift: true },
      '(': { keyCode: '9', withShift: true },
      ')': { keyCode: '0', withShift: true },
      _: { keyCode: QKeyCode.MINUS, withShift: true },
      '+': { keyCode: QKeyCode.EQUAL, withShift: true },
      '{': { keyCode: QKeyCode.BRACKET_LEFT, withShift: true },
      '}': { keyCode: QKeyCode.BRACKET_RIGHT, withShift: true },
      '|': { keyCode: QKeyCode.BACKSLASH, withShift: true },
      ':': { keyCode: QKeyCode.SEMICOLON, withShift: true },
      '"': { keyCode: QKeyCode.APOSTROPHE, withShift: true },
      '<': { keyCode: QKeyCode.COMMA, withShift: true },
      '>': { keyCode: QKeyCode.DOT, withShift: true },
      '?': { keyCode: QKeyCode.SLASH, withShift: true },
      '~': { keyCode: QKeyCode.GRAVE, withShift: true },
    };

    return specialCharMap[char] || null;
  }

  /**
   * Sends a key combination (e.g., "ctrl+alt+delete") to the VM.
   *
   * @param combination A string representing the key combination (e.g., "ctrl+alt+delete").
   */
  async sendKeyCombination(combination: string): Promise<void> {
    const keys = combination.toLowerCase().split('+');
    const keySequence: string[] = [];

    // Map key names to QKeyCodes
    for (const key of keys) {
      switch (key.trim()) {
        case 'ctrl':
          keySequence.push(QKeyCode.LEFT_CTRL);
          break;
        case 'alt':
          keySequence.push(QKeyCode.LEFT_ALT);
          break;
        case 'shift':
          keySequence.push(QKeyCode.LEFT_SHIFT);
          break;
        case 'meta':
        case 'cmd':
        case 'win':
          keySequence.push(QKeyCode.LEFT_META);
          break;
        case 'esc':
          keySequence.push(QKeyCode.ESC);
          break;
        case 'delete':
        case 'del':
          keySequence.push(QKeyCode.DELETE);
          break;
        case 'backspace':
          keySequence.push(QKeyCode.BACKSPACE);
          break;
        case 'enter':
        case 'return':
          keySequence.push(QKeyCode.ENTER);
          break;
        case 'tab':
          keySequence.push(QKeyCode.TAB);
          break;
        case 'space':
          keySequence.push(QKeyCode.SPACE);
          break;
        case 'up':
          keySequence.push(QKeyCode.UP);
          break;
        case 'down':
          keySequence.push(QKeyCode.DOWN);
          break;
        case 'left':
          keySequence.push(QKeyCode.LEFT);
          break;
        case 'right':
          keySequence.push(QKeyCode.RIGHT);
          break;
        default:
          // Handle function keys (f1-f12)
          if (/^f([1-9]|1[0-2])$/.test(key)) {
            const fKey = `F${key.substring(1)}` as keyof typeof QKeyCode;
            keySequence.push(QKeyCode[fKey]);
          }
          // Handle single character keys
          else if (key.length === 1) {
            const keyInfo = this.charToKeyInfo(key);
            if (keyInfo) {
              keySequence.push(keyInfo.keyCode);
            } else {
              this.logger.warn(`Unknown key in combination: ${key}`);
            }
          } else {
            this.logger.warn(`Unknown key in combination: ${key}`);
          }
      }
    }

    this.logger.log(
      `Sending key combination: ${combination} (${keySequence.join(', ')})`,
    );

    // Press all keys in sequence
    for (const key of keySequence) {
      await this.sendKey(key);
    }

    // Release all keys in reverse order
    for (let i = keySequence.length - 1; i >= 0; i--) {
      await this.sendKey(keySequence[i]);
    }
  }

  /**
   * Moves the mouse pointer to the specified absolute coordinates.
   * @param x The absolute x-coordinate.
   * @param y The absolute y-coordinate.
   */
  async mouseMove(x: number, y: number): Promise<any> {
    this.logger.log(`Moving mouse to coordinates: (${x}, ${y})`);
    const command = {
      execute: 'input-send-event',
      arguments: {
        events: [
          {
            type: 'abs',
            data: { axis: 'x', value: this.scaleXCoordinate(x) },
          },
          {
            type: 'abs',
            data: { axis: 'y', value: this.scaleYCoordinate(y) },
          },
        ],
      },
    };
    try {
      return await this.qmpClient.sendCommand(command);
    } catch (error) {
      throw new Error(
        `Failed to move mouse to coordinates (${x}, ${y}): ${error.message}`,
      );
    }
  }

  /**
   * Sends a mouse button event to the VM.
   *
   * @param button One of 'left', 'right', or 'middle'.
   * @param pressed True for a button press; false for a release.
   */
  async mouseButtonEvent(
    button: 'left' | 'right' | 'middle',
    pressed: boolean,
  ): Promise<any> {
    const command = {
      execute: 'input-send-event',
      arguments: {
        events: [
          {
            type: 'btn',
            data: {
              down: pressed,
              button: button,
            },
          },
        ],
      },
    };
    this.logger.log(
      `Mouse button event: ${button} ${pressed ? 'pressed' : 'released'}`,
    );
    try {
      return await this.qmpClient.sendCommand(command);
    } catch (error) {
      throw new Error(
        `Failed to send mouse ${button} button ${pressed ? 'press' : 'release'} event: ${error.message}`,
      );
    }
  }

  /**
   * Performs a complete mouse click (press and release) with an optional delay between events.
   *
   * @param button One of 'left', 'right', or 'middle'.
   * @param delayMs Delay in milliseconds between press and release (default is 100ms).
   */
  async mouseClick(
    button: 'left' | 'right' | 'middle',
    delayMs: number = 100,
  ): Promise<any> {
    try {
      await this.mouseButtonEvent(button, true);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return await this.mouseButtonEvent(button, false);
    } catch (error) {
      throw new Error(
        `Failed to perform ${button} mouse click: ${error.message}`,
      );
    }
  }

  /**
   * Sends a mouse wheel event to the VM.
   *
   * @param axis Either 'v' for vertical or 'h' for horizontal scrolling
   * @param value Positive values scroll up/right, negative values scroll down/left
   */
  async mouseWheel(axis: 'v' | 'h', value: number): Promise<any> {
    const command = {
      execute: 'input-send-event',
      arguments: {
        events: [
          {
            type: 'rel',
            data: {
              axis: axis === 'v' ? 'wheel' : 'hwheel',
              value:
                axis === 'v'
                  ? this.scaleYCoordinate(value)
                  : this.scaleXCoordinate(value),
            },
          },
        ],
      },
    };
    this.logger.log(`Mouse wheel event: ${axis}-axis, value: ${value}`);
    return this.qmpClient.sendCommand(command);
  }

  private scaleXCoordinate(value: number): number {
    const screenWidth = 1280;
    const maxValue = 32767;

    this.logger.log(
      `Scaling x-coordinate: ${value} -> ${Math.round((value / screenWidth) * maxValue)}`,
    );
    return Math.round((value / screenWidth) * maxValue);
  }

  private scaleYCoordinate(value: number): number {
    const screenHeight = 800;
    const maxValue = 32767;

    this.logger.log(
      `Scaling y-coordinate: ${value} -> ${Math.round((value / screenHeight) * maxValue)}`,
    );
    return Math.round((value / screenHeight) * maxValue);
  }
}
