import { Injectable, Logger } from '@nestjs/common';
import { QemuService } from '../qemu/qemu.service';

export type Button = 'left' | 'right' | 'middle';

@Injectable()
export class ComputerUseService {
  private readonly logger = new Logger(ComputerUseService.name);
  // Track the last known cursor position.
  private cursorPosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor(private readonly qemuService: QemuService) {}

  /**
   * "key": Sends a single key event.
   * @param key A string representing the key (e.g. "enter", "a", etc.).
   */
  async key(key: string): Promise<any> {
    this.logger.log(`Sending key: ${key}`);
    return this.qemuService.sendKey(key);
  }

  /**
   * "type": Simulates typing text by sending each character with a small delay.
   * @param text The text to type.
   * @param delayMs Optional delay in milliseconds between keystrokes (default 100ms).
   */
  async type(text: string, delayMs: number = 100): Promise<void> {
    this.logger.log(`Typing text: ${text}`);
    await this.qemuService.typeText(text, delayMs);
  }

  /**
   * "mouse_move": Moves the mouse pointer to the specified coordinates.
   * @param x The absolute x-coordinate.
   * @param y The absolute y-coordinate.
   */
  async mouse_move(x: number, y: number): Promise<any> {
    this.logger.log(`Moving mouse to: (${x}, ${y})`);
    this.cursorPosition = { x, y };
    return this.qemuService.mouseMove(x, y);
  }

  /**
   * "left_click": Performs a left mouse click at the current cursor position.
   */
  async left_click(): Promise<void> {
    this.logger.log(
      `Performing left click at (${this.cursorPosition.x}, ${this.cursorPosition.y})`,
    );
    await this.qemuService.mouseClick('left');
  }

  /**
   * "left_click_drag": Clicks, holds, moves, and then releases the left mouse button.
   * @param startX Starting x-coordinate.
   * @param startY Starting y-coordinate.
   * @param endX Ending x-coordinate.
   * @param endY Ending y-coordinate.
   * @param holdMs Optional delay (in ms) to hold the click before dragging (default 100ms).
   */
  async left_click_drag(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    holdMs: number = 100,
  ): Promise<void> {
    this.logger.log(
      `Performing left click drag from (${startX}, ${startY}) to (${endX}, ${endY})`,
    );
    // Move to the starting position.
    await this.mouse_move(startX, startY);
    // Press the left button down.
    await this.qemuService.mouseButtonEvent('left', true);
    // Hold for a moment.
    await this.delay(holdMs);
    // Drag to the ending position.
    await this.mouse_move(endX, endY);
    // Release the left button.
    await this.qemuService.mouseButtonEvent('left', false);
    // Update the tracked cursor position.
    this.cursorPosition = { x: endX, y: endY };
  }

  /**
   * "right_click": Performs a right mouse click at the current cursor position.
   */
  async right_click(): Promise<void> {
    this.logger.log(
      `Performing right click at (${this.cursorPosition.x}, ${this.cursorPosition.y})`,
    );
    await this.qemuService.mouseClick('right');
  }

  /**
   * "middle_click": Performs a middle mouse click at the current cursor position.
   */
  async middle_click(): Promise<void> {
    this.logger.log(
      `Performing middle click at (${this.cursorPosition.x}, ${this.cursorPosition.y})`,
    );
    await this.qemuService.mouseClick('middle');
  }

  /**
   * "double_click": Performs two consecutive left clicks with a short delay.
   * @param delayMs Optional delay between clicks (default 100ms).
   */
  async double_click(delayMs: number = 100): Promise<void> {
    this.logger.log(
      `Performing double click at (${this.cursorPosition.x}, ${this.cursorPosition.y})`,
    );
    await this.left_click();
    await this.delay(delayMs);
    await this.left_click();
  }

  /**
   * "screenshot": Captures a screenshot and returns it as a Base64 encoded string.
   */
  async screenshot(): Promise<{ image: string }> {
    this.logger.log(`Taking screenshot`);
    const buffer = await this.qemuService.screendump();
    return { image: `data:image/png;base64,${buffer.toString('base64')}` };
  }

  /**
   * "cursor_position": Returns the last known cursor position.
   */
  async cursor_position(): Promise<{ x: number; y: number }> {
    this.logger.log(
      `Returning cursor position: (${this.cursorPosition.x}, ${this.cursorPosition.y})`,
    );
    return this.cursorPosition;
  }

  /**
   * "scroll": Performs a mouse wheel scroll action.
   * @param amount The amount to scroll. Positive values scroll up, negative values scroll down.
   * @param axis Optional axis to scroll on. 'v' for vertical (default), 'h' for horizontal.
   */
  async scroll(amount: number, axis: 'v' | 'h' = 'v'): Promise<any> {
    this.logger.log(
      `Scrolling ${axis === 'v' ? 'vertically' : 'horizontally'} by ${amount}`,
    );
    return this.qemuService.mouseWheel(axis, amount);
  }

  // Helper: a simple delay.
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
