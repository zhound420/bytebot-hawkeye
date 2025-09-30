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
import { spawn } from 'child_process';
import * as path from 'path';

/**
 * Enum representing key codes supported by nut-js.
 * Maps to the same structure as QKeyCode for compatibility.
 */

const XKeySymToNutKeyMap: Record<string, Key> = {
  // Alphanumeric Keys
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
  bracketleft: Key.LeftBracket,
  bracketright: Key.RightBracket,
  apostrophe: Key.Quote,

  // Modifier Keys
  Shift: Key.LeftShift,
  ctrl: Key.LeftControl,
  Control: Key.LeftControl,
  Super: Key.LeftSuper,
  Alt: Key.LeftAlt,
  Meta: Key.LeftMeta,
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
  Page_Up: Key.PageUp,
  Page_Down: Key.PageDown,

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

  // Multimedia Keys
  AudioLowerVolume: Key.AudioVolDown,
  AudioRaiseVolume: Key.AudioVolUp,
  AudioRandomPlay: Key.AudioRandom,
};

const XKeySymToNutKeyMapLowercase: Record<string, Key> = Object.entries(
  XKeySymToNutKeyMap,
).reduce(
  (map, [key, value]) => {
    map[key.toLowerCase()] = value;
    return map;
  },
  {} as Record<string, Key>,
);

const NutKeyMap = Object.entries(Key)
  .filter(([name]) => isNaN(Number(name)))
  .reduce(
    (map, [name, value]) => {
      map[name] = value as Key;
      return map;
    },
    {} as Record<string, Key>,
  );

// Create a map of lowercase keys to nutjs keys
const NutKeyMapLowercase: Record<string, Key> = Object.entries(Key)
  // we only want the string→number pairs (filter out the reverse numeric keys)
  .filter(([name]) => isNaN(Number(name)))
  .reduce(
    (map, [name, value]) => {
      map[name.toLowerCase()] = value as Key;
      return map;
    },
    {} as Record<string, Key>,
  );

@Injectable()
export class NutService {
  private readonly logger = new Logger(NutService.name);
  private screenshotDir: string;
  private availableKeysCache: string[] | null = null;
  private availableKeySet: Set<string> | null = null;

  constructor() {
    // Initialize nut-js settings
    mouse.config.autoDelayMs = 100;
    keyboard.config.autoDelayMs = 100;

    // Create screenshot directory if it doesn't exist
    this.screenshotDir = path.join('/tmp', 'bytebot-screenshots');
    import('fs').then((fs) => {
      fs.promises
        .mkdir(this.screenshotDir, { recursive: true })
        .catch((err) => {
          this.logger.error(
            `Failed to create screenshot directory: ${err.message}`,
          );
        });
    });
  }

  /**
   * Sends key shortcut sequences to the computer.
   *
   * @param keys An array of key strings (supports compound forms such as "ctrl+shift+p").
   */
  async sendKeys(keys: string[]): Promise<void> {
    try {
      const parsedKeys: string[] = [];

      for (const keyInput of keys) {
        const individualKeys = this.parseKeyInput(keyInput);
        parsedKeys.push(...individualKeys);
      }

      this.validateKeySequence(parsedKeys);

      this.logger.log(`Sending keys: ${parsedKeys.join(',')}`);
      await this.executeKeySequence(parsedKeys);
    } catch (error) {
      this.logger.error(`Failed to send keys: ${error.message}`);
      throw new Error(`Failed to send keys: ${error.message}`);
    }
  }

  private async executeKeySequence(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    const nutKeys = keys.map((key) => this.validateKey(key));
    await keyboard.pressKey(...nutKeys);
    await this.delay(100);
    await keyboard.releaseKey(...nutKeys);
  }

  /**
   * Holds or releases keys.
   *
   * @param keys An array of key strings.
   * @param down True to press the keys down, false to release them.
   */
  async holdKeys(keys: string[], down: boolean): Promise<any> {
    try {
      const normalizedKeys = keys
        .flatMap((key) => this.parseKeyInput(key))
        .filter((entry) => entry.length > 0);

      this.validateKeySequence(normalizedKeys);

      for (const key of normalizedKeys) {
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
    // Try exact matches first
    let nutKey: Key | undefined = XKeySymToNutKeyMap[key] || NutKeyMap[key];

    // If not found, try case-insensitive matching
    if (nutKey === undefined) {
      const lowerKey = key.toLowerCase();

      // Try to find case-insensitive match in XKeySymToNutKeyMapLowercase or NutKeyMapLowercase
      nutKey =
        XKeySymToNutKeyMapLowercase[lowerKey] || NutKeyMapLowercase[lowerKey];
    }

    if (nutKey === undefined) {
      throw new Error(
        `Invalid key: '${key}'. Key not found in available key mappings.`,
      );
    }

    return nutKey;
  }

  private parseKeyInput(keyInput: string): string[] {
    if (!keyInput) {
      return [];
    }

    if (keyInput.includes('+')) {
      return keyInput
        .split('+')
        .map((segment) => this.normalizeKeyName(segment.trim()))
        .filter((segment) => segment.length > 0);
    }

    return [this.normalizeKeyName(keyInput.trim())];
  }

  private normalizeKeyName(key: string): string {
    if (!key) {
      return '';
    }

    const keyMappings: Record<string, string> = {
      // Modifier keys
      ctrl: 'Control',
      control: 'Control',
      shift: 'Shift',
      alt: 'Alt',
      option: 'Alt',
      cmd: 'Meta',
      meta: 'Meta',
      win: 'Super',
      windows: 'Super',

      // Special keys
      enter: 'Return',
      ret: 'Return',
      return: 'Return',
      esc: 'Escape',
      escape: 'Escape',
      space: 'Space',
      spacebar: 'Space',
      tab: 'Tab',
      backspace: 'BackSpace',
      delete: 'Delete',
      del: 'Delete',

      // Arrow keys
      up: 'Up',
      down: 'Down',
      left: 'Left',
      right: 'Right',
      arrowup: 'Up',
      arrowdown: 'Down',
      arrowleft: 'Left',
      arrowright: 'Right',

      // Function keys
      f1: 'F1',
      f2: 'F2',
      f3: 'F3',
      f4: 'F4',
      f5: 'F5',
      f6: 'F6',
      f7: 'F7',
      f8: 'F8',
      f9: 'F9',
      f10: 'F10',
      f11: 'F11',
      f12: 'F12',
    };

    const normalized = key.toLowerCase();
    if (normalized === 'enter' && key.toUpperCase() === 'ENTER') {
      return 'Return';
    }
    const mapped = keyMappings[normalized];
    if (mapped) {
      return mapped;
    }

    return key;
  }

  private validateKeySequence(keys: string[]): void {
    if (!keys.length) {
      return;
    }

    const invalidKeys = keys.filter((key) => !this.isValidKey(key));

    if (invalidKeys.length > 0) {
      const availableKeys = this.getAvailableKeys();
      const preview = availableKeys.slice(0, 10).join(', ');
      throw new Error(
        `Invalid keys: ${invalidKeys.join(', ')}. Available keys: ${preview}...(${availableKeys.length} total keys available)`,
      );
    }
  }

  private isValidKey(key: string): boolean {
    if (!key) {
      return false;
    }

    this.ensureAvailableKeyCache();
    if (this.availableKeySet?.has(key)) {
      return true;
    }
    if (this.availableKeySet?.has(key.toLowerCase())) {
      return true;
    }

    try {
      this.validateKey(key);
      return true;
    } catch {
      return false;
    }
  }

  private getAvailableKeys(): string[] {
    this.ensureAvailableKeyCache();
    return this.availableKeysCache ?? [];
  }

  private ensureAvailableKeyCache(): void {
    if (this.availableKeysCache) {
      return;
    }

    const keys = new Set<string>();
    const addKey = (value: string) => {
      if (!value) {
        return;
      }
      keys.add(value);
      keys.add(value.toLowerCase());
    };

    Object.keys(XKeySymToNutKeyMap).forEach(addKey);
    Object.keys(NutKeyMap).forEach(addKey);
    Object.keys(XKeySymToNutKeyMapLowercase).forEach(addKey);
    Object.keys(NutKeyMapLowercase).forEach(addKey);

    this.availableKeysCache = Array.from(keys).sort((a, b) =>
      a.localeCompare(b),
    );
    this.availableKeySet = new Set(this.availableKeysCache);
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
      for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (char === '\r' && text[i + 1] === '\n') {
          continue;
        }
        const keyInfo = this.charToKeyInfo(char);
        if (keyInfo) {
          if (keyInfo.withShift) {
            // Hold shift key, press the character key, and release shift key
            await keyboard.pressKey(Key.LeftShift, keyInfo.keyCode);
            await keyboard.releaseKey(Key.LeftShift, keyInfo.keyCode);
          } else {
            await keyboard.pressKey(keyInfo.keyCode);
            await keyboard.releaseKey(keyInfo.keyCode);
          }
          if (delayMs > 0 && i < text.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        } else {
          throw new Error(`No key mapping found for character: ${char}`);
        }
      }
    } catch (error) {
      throw new Error(`Failed to type text: ${error.message}`);
    }
  }

  async pasteText(text: string): Promise<void> {
    this.logger.log(`Pasting text: ${text}`);

    try {
      // Copy text to clipboard using xclip via spawn
      await new Promise<void>((resolve, reject) => {
        const child = spawn('xclip', ['-selection', 'clipboard'], {
          env: { ...process.env, DISPLAY: ':0.0' },
          stdio: ['pipe', 'ignore', 'inherit'],
        });

        child.once('error', reject);
        child.once('close', (code) => {
          code === 0
            ? resolve()
            : reject(new Error(`xclip exited with code ${code}`));
        });

        child.stdin.write(text);
        child.stdin.end();
      });

      // brief pause to ensure clipboard owner is set
      await new Promise((resolve) => setTimeout(resolve, 100));

      await keyboard.pressKey(Key.LeftControl, Key.V);
      await keyboard.releaseKey(Key.LeftControl, Key.V);
    } catch (error) {
      throw new Error(`Failed to paste text: ${error.message}`);
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
  ): { keyCode: Key; withShift: boolean } | null {
    // Handle lowercase letters
    if (/^[a-z]$/.test(char)) {
      return { keyCode: this.validateKey(char), withShift: false };
    }

    // Handle uppercase letters (need to send shift + lowercase)
    if (/^[A-Z]$/.test(char)) {
      return {
        keyCode: this.validateKey(char.toLowerCase()),
        withShift: true,
      };
    }

    // Handle numbers
    if (/^[0-9]$/.test(char)) {
      return { keyCode: this.validateKey(char), withShift: false };
    }

    // Handle special characters
    const newlineChar = '\n';
    const carriageReturnChar = '\r';
    const specialCharMap: Record<string, { keyCode: Key; withShift: boolean }> =
      {
        ' ': { keyCode: Key.Space, withShift: false },
        '.': { keyCode: Key.Period, withShift: false },
        ',': { keyCode: Key.Comma, withShift: false },
        ';': { keyCode: Key.Semicolon, withShift: false },
        "'": { keyCode: Key.Quote, withShift: false },
        '`': { keyCode: Key.Grave, withShift: false },
        '-': { keyCode: Key.Minus, withShift: false },
        '=': { keyCode: Key.Equal, withShift: false },
        '[': { keyCode: Key.LeftBracket, withShift: false },
        ']': { keyCode: Key.RightBracket, withShift: false },
        '\\': { keyCode: Key.Backslash, withShift: false },
        '/': { keyCode: Key.Slash, withShift: false },

        // Characters that require shift
        '!': { keyCode: Key.Num1, withShift: true },
        '@': { keyCode: Key.Num2, withShift: true },
        '#': { keyCode: Key.Num3, withShift: true },
        $: { keyCode: Key.Num4, withShift: true },
        '%': { keyCode: Key.Num5, withShift: true },
        '^': { keyCode: Key.Num6, withShift: true },
        '&': { keyCode: Key.Num7, withShift: true },
        '*': { keyCode: Key.Num8, withShift: true },
        '(': { keyCode: Key.Num9, withShift: true },
        ')': { keyCode: Key.Num0, withShift: true },
        _: { keyCode: Key.Minus, withShift: true },
        '+': { keyCode: Key.Equal, withShift: true },
        '{': { keyCode: Key.LeftBracket, withShift: true },
        '}': { keyCode: Key.RightBracket, withShift: true },
        '|': { keyCode: Key.Backslash, withShift: true },
        ':': { keyCode: Key.Semicolon, withShift: true },
        '"': { keyCode: Key.Quote, withShift: true },
        '<': { keyCode: Key.Comma, withShift: true },
        '>': { keyCode: Key.Period, withShift: true },
        '?': { keyCode: Key.Slash, withShift: true },
        '~': { keyCode: Key.Grave, withShift: true },
        [newlineChar]: { keyCode: Key.Enter, withShift: false },
        [carriageReturnChar]: { keyCode: Key.Enter, withShift: false },
      };

    return specialCharMap[char] || null;
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
      return await import('fs').then((fs) => fs.promises.readFile(filepath));
    } catch (error) {
      this.logger.error(`Error taking screenshot: ${error.message}`);
      throw error;
    } finally {
      // Clean up the temporary file
      try {
        await import('fs').then((fs) => fs.promises.unlink(filepath));
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
