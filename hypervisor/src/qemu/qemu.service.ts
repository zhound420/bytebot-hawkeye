// src/qemu/qemu.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { QmpClientService } from './qmp-client.service';
import { promises as fs } from 'fs';

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

export const xKeySymToQKeyCodeMap: Record<string, QKeyCode> = {
  Escape: QKeyCode.ESC,
  BackSpace: QKeyCode.BACKSPACE,
  Return: QKeyCode.RETURN,
  Caps_Lock: QKeyCode.CAPS_LOCK,
  Shift_L: QKeyCode.LEFT_SHIFT,
  Shift_R: QKeyCode.RIGHT_SHIFT,
  Control_L: QKeyCode.LEFT_CTRL,
  Control_R: QKeyCode.RIGHT_CTRL,
  Alt_L: QKeyCode.LEFT_ALT,
  Alt_R: QKeyCode.RIGHT_ALT,
  Meta_L: QKeyCode.LEFT_META,
  Meta_R: QKeyCode.RIGHT_META,
  space: QKeyCode.SPACE,
  Page_Up: QKeyCode.PAGE_UP,
  Page_Down: QKeyCode.PAGE_DOWN,

  grave: QKeyCode.GRAVE,
  bracketleft: QKeyCode.BRACKET_LEFT,
  bracketright: QKeyCode.BRACKET_RIGHT,
  period: QKeyCode.DOT,
};

@Injectable()
export class QemuService {
  private readonly logger = new Logger(QemuService.name);

  constructor(private readonly qmpClient: QmpClientService) {}

  /**
   * Sends key events (e.g., "ctrl-alt-delete") to the VM.
   *
   * @param key A string representing the key events.
   */
  async sendKeys(keys: string[], delay: number = 100): Promise<any> {
    this.logger.log(`Sending keys: ${keys}`);

    try {
      const command = {
        execute: 'send-key',
        arguments: {
          keys: keys.map((key) => ({
            type: 'qcode',
            data: this.validateKey(key),
          })),
          'hold-time': delay,
        },
      };
      return await this.qmpClient.sendCommand(command);
    } catch (error) {
      throw new Error(`Failed to send keys: ${error.message}`);
    }
  }

  async holdKeys(keys: string[], down: boolean): Promise<any> {
    try {
      const command = {
        execute: 'input-send-event',
        arguments: {
          events: keys.map((key) => ({
            type: 'key',
            data: {
              down,
              key: { type: 'qcode', data: this.validateKey(key) },
            },
          })),
        },
      };

      return await this.qmpClient.sendCommand(command);
    } catch (error) {
      throw new Error(`Failed to hold keys: ${error.message}`);
    }
  }

  private validateKey(key: string): QKeyCode {
    const qkeyCodes: string[] = Object.values(QKeyCode);

    if (!qkeyCodes.includes(key)) {
      const qkey = xKeySymToQKeyCodeMap[key];
      if (qkey) {
        return qkey;
      }

      throw new Error(`Invalid key: ${key}`);
    }

    return key as QKeyCode;
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
          // Hold shift key, press the character key, and release shift key
          await this.holdKeys([QKeyCode.LEFT_SHIFT], true);
          await this.sendKeys([keyInfo.keyCode]);
          await this.holdKeys([QKeyCode.LEFT_SHIFT], false);
        } else {
          await this.sendKeys([keyInfo.keyCode]);
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
   * Moves the mouse pointer to the specified absolute coordinates.
   * @param x The absolute x-coordinate.
   * @param y The absolute y-coordinate.
   */
  async mouseMoveEvent({ x, y }: { x: number; y: number }): Promise<any> {
    this.logger.log(`Moving mouse to coordinates: (${x}, ${y})`);
    try {
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
   * Sends a mouse wheel event to the VM.
   *
   * @param direction Either 'right', 'left', 'up', or 'down'
   * @param amount Number of scroll steps to perform
   */
  async mouseWheelEvent(
    direction: 'right' | 'left' | 'up' | 'down',
    amount: number,
  ): Promise<any> {
    const btn =
      direction === 'right'
        ? 'wheel-right'
        : direction === 'left'
          ? 'wheel-left'
          : direction === 'up'
            ? 'wheel-up'
            : 'wheel-down';

    for (let i = 0; i < amount; i++) {
      const command = {
        execute: 'input-send-event',
        arguments: {
          events: [
            { type: 'btn', data: { down: true, button: btn } },
            { type: 'btn', data: { down: false, button: btn } },
          ],
        },
      };
      this.logger.log(`Mouse wheel event: wheel-${direction}`);
      await this.qmpClient.sendCommand(command);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
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

  /**
   * Implementation of screendump that uses a direct file path.
   * Some QEMU versions may have issues with certain paths.
   *
   * @returns A Promise that resolves with a Buffer containing the image.
   */
  async screendump(): Promise<Buffer> {
    // Use a simple, direct path in /tmp
    const tmpFile = `/tmp/qemu-screen-${Date.now()}.png`;
    this.logger.log(`Taking screendump with direct path: ${tmpFile}`);

    try {
      const response = await this.qmpClient.sendCommand({
        execute: 'screendump',
        arguments: { filename: tmpFile, format: 'png' },
      });

      // Add a longer delay to ensure QEMU has time to write the file
      await new Promise((resolve) => setTimeout(resolve, 1500));

      this.logger.log(`QMP screendump response: ${JSON.stringify(response)}`);

      // Check if file exists
      try {
        await fs.access(tmpFile);
        this.logger.log(`Screenshot file exists at ${tmpFile}`);
      } catch (accessErr) {
        this.logger.error(
          `Screenshot file does not exist: ${accessErr.message}`,
        );
        throw new Error(`Screenshot file not found at ${tmpFile}`);
      }

      // Read the file
      const imageBuffer = await fs.readFile(tmpFile);
      this.logger.log(
        `Successfully read screenshot file (${imageBuffer.length} bytes)`,
      );

      // Log the first few bytes for debugging
      if (imageBuffer.length > 0) {
        const hexDump = imageBuffer
          .slice(0, Math.min(16, imageBuffer.length))
          .toString('hex')
          .match(/.{1,2}/g)
          ?.join(' ');
        this.logger.log(`First bytes: ${hexDump}`);
      }

      return imageBuffer;
    } catch (error) {
      this.logger.error(`Error in screendumpDirect: ${error.message}`);
      throw error;
    } finally {
      // Clean up the temporary file
      try {
        await fs.unlink(tmpFile);
      } catch (unlinkError) {
        // Ignore if file doesn't exist
        if (!unlinkError.message.includes('ENOENT')) {
          this.logger.warn(
            `Failed to remove temporary screenshot file ${tmpFile}: ${unlinkError.message}`,
          );
        }
      }
    }
  }
}
