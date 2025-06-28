import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { ComputerUseService } from '../computer-use/computer-use.service';
import { compressPngBase64Under1MB } from './compressor';

@Injectable()
export class ComputerUseTools {
  constructor(private readonly computerUse: ComputerUseService) {}

  @Tool({
    name: 'computer_move_mouse',
    description: 'Moves the mouse cursor to the specified coordinates.',
    parameters: z.object({
      coordinates: z.object({
        x: z.number().describe('The x-coordinate to move the mouse to.'),
        y: z.number().describe('The y-coordinate to move the mouse to.'),
      }),
    }),
  })
  async moveMouse({ coordinates }: { coordinates: { x: number; y: number } }) {
    try {
      await this.computerUse.action({ action: 'move_mouse', coordinates });
      return { content: [{ type: 'text', text: 'mouse moved' }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error moving mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_trace_mouse',
    description:
      'Moves the mouse cursor along a specified path of coordinates.',
    parameters: z.object({
      path: z
        .array(
          z.object({
            x: z.number().describe('The x-coordinate to move the mouse to.'),
            y: z.number().describe('The y-coordinate to move the mouse to.'),
          }),
        )
        .describe('An array of coordinate objects representing the path.'),
      holdKeys: z
        .array(z.string())
        .optional()
        .describe('Optional array of keys to hold during the trace.'),
    }),
  })
  async traceMouse({
    path,
    holdKeys,
  }: {
    path: { x: number; y: number }[];
    holdKeys?: string[];
  }) {
    try {
      await this.computerUse.action({ action: 'trace_mouse', path, holdKeys });
      return {
        content: [{ type: 'text', text: 'mouse traced' }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error tracing mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_click_mouse',
    description:
      'Performs a mouse click at the specified coordinates or current position.',
    parameters: z.object({
      coordinates: z
        .object({
          x: z.number().describe('The x-coordinate to move the mouse to.'),
          y: z.number().describe('The y-coordinate to move the mouse to.'),
        })
        .optional()
        .describe(
          'Optional coordinates for the click. If not provided, clicks at the current mouse position.',
        ),
      button: z
        .enum(['left', 'right', 'middle'])
        .describe('The mouse button to click.'),
      holdKeys: z
        .array(z.string())
        .optional()
        .describe('Optional array of keys to hold during the click.'),
      numClicks: z
        .number()
        .describe('Number of clicks to perform (e.g., 2 for double-click).'),
    }),
  })
  async clickMouse({
    coordinates,
    button,
    holdKeys,
    numClicks,
  }: {
    coordinates?: { x: number; y: number };
    button: 'left' | 'right' | 'middle';
    holdKeys?: string[];
    numClicks: number;
  }) {
    try {
      await this.computerUse.action({
        action: 'click_mouse',
        coordinates,
        button,
        holdKeys,
        numClicks,
      });
      return {
        content: [{ type: 'text', text: 'mouse clicked' }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error clicking mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_press_mouse',
    description:
      'Presses or releases a specified mouse button at the given coordinates or current position.',
    parameters: z.object({
      coordinates: z
        .object({
          x: z.number().describe('The x-coordinate for the mouse action.'),
          y: z.number().describe('The y-coordinate for the mouse action.'),
        })
        .optional()
        .describe(
          'Optional coordinates for the mouse press/release. If not provided, uses the current mouse position.',
        ),
      button: z
        .enum(['left', 'right', 'middle'])
        .describe('The mouse button to press or release.'),
      press: z
        .enum(['down', 'up'])
        .describe('The action to perform (press or release).'),
    }),
  })
  async pressMouse({
    coordinates,
    button,
    press,
  }: {
    coordinates?: { x: number; y: number };
    button: 'left' | 'right' | 'middle';
    press: 'down' | 'up';
  }) {
    try {
      await this.computerUse.action({
        action: 'press_mouse',
        coordinates,
        button,
        press,
      });
      return {
        content: [{ type: 'text', text: 'mouse pressed' }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error pressing mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_drag_mouse',
    description:
      'Drags the mouse from a starting point along a path while holding a specified button.',
    parameters: z.object({
      path: z
        .array(
          z.object({
            x: z
              .number()
              .describe('The x-coordinate of a point in the drag path.'),
            y: z
              .number()
              .describe('The y-coordinate of a point in the drag path.'),
          }),
        )
        .describe(
          'An array of coordinate objects representing the drag path. The first coordinate is the start point.',
        ),
      button: z
        .enum(['left', 'right', 'middle'])
        .describe('The mouse button to hold while dragging.'),
      holdKeys: z
        .array(z.string())
        .optional()
        .describe('Optional array of keys to hold during the drag.'),
    }),
  })
  async dragMouse({
    path,
    button,
    holdKeys,
  }: {
    path: { x: number; y: number }[];
    button: 'left' | 'right' | 'middle';
    holdKeys?: string[];
  }) {
    try {
      await this.computerUse.action({
        action: 'drag_mouse',
        path,
        button,
        holdKeys,
      });
      return {
        content: [{ type: 'text', text: 'mouse dragged' }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error dragging mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_scroll',
    description: 'Scrolls the mouse wheel up, down, left, or right.',
    parameters: z.object({
      coordinates: z
        .object({
          x: z
            .number()
            .describe(
              'The x-coordinate for the scroll action (if applicable).',
            ),
          y: z
            .number()
            .describe(
              'The y-coordinate for the scroll action (if applicable).',
            ),
        })
        .optional()
        .describe(
          'Coordinates for where the scroll should occur. Behavior might depend on the OS/application.',
        ),
      direction: z
        .enum(['up', 'down', 'left', 'right'])
        .describe('The direction to scroll the mouse wheel.'),
      numScrolls: z
        .number()
        .describe('The number of times to scroll the mouse wheel.'),
      holdKeys: z
        .array(z.string())
        .optional()
        .describe('Optional array of keys to hold during the scroll.'),
    }),
  })
  async scroll({
    coordinates,
    direction,
    numScrolls,
    holdKeys,
  }: {
    coordinates?: { x: number; y: number };
    direction: 'up' | 'down' | 'left' | 'right';
    numScrolls: number;
    holdKeys?: string[];
  }) {
    try {
      await this.computerUse.action({
        action: 'scroll',
        coordinates,
        direction,
        numScrolls,
        holdKeys,
      });
      return { content: [{ type: 'text', text: 'scrolled' }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error scrolling: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_type_keys',
    description:
      'Simulates typing a sequence of keys, often used for shortcuts involving modifier keys (e.g., Ctrl+C). Presses and releases each key in order.',
    parameters: z.object({
      keys: z
        .array(z.string())
        .describe(
          'An array of key names to type in sequence (e.g., ["control", "c"]).',
        ),
      delay: z
        .number()
        .optional()
        .describe('Optional delay in milliseconds between key presses.'),
    }),
  })
  async typeKeys({ keys, delay }: { keys: string[]; delay?: number }) {
    try {
      await this.computerUse.action({ action: 'type_keys', keys, delay });
      return { content: [{ type: 'text', text: 'keys typed' }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error typing keys: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_press_keys',
    description:
      'Simulates pressing down or releasing specific keys. Useful for holding modifier keys.',
    parameters: z.object({
      keys: z
        .array(z.string())
        .describe(
          'An array of key names to press or release (e.g., ["shift"]).',
        ),
      press: z
        .enum(['down', 'up'])
        .describe('Whether to press the keys down or release them up.'),
    }),
  })
  async pressKeys({ keys, press }: { keys: string[]; press: 'down' | 'up' }) {
    try {
      await this.computerUse.action({ action: 'press_keys', keys, press });
      return { content: [{ type: 'text', text: 'keys pressed' }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error pressing keys: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_type_text',
    description: 'Simulates typing a string of text character by character.',
    parameters: z.object({
      text: z.string().describe('The text string to type.'),
      delay: z
        .number()
        .optional()
        .describe('Optional delay in milliseconds between key presses.'),
    }),
  })
  async typeText({ text, delay }: { text: string; delay?: number }) {
    try {
      await this.computerUse.action({ action: 'type_text', text, delay });
      return { content: [{ type: 'text', text: 'text typed' }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error typing text: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_wait',
    description: 'Pauses execution for a specified duration.',
    parameters: z.object({
      duration: z
        .number()
        .default(500)
        .describe('The duration to wait in milliseconds.'),
    }),
  })
  async wait({ duration }: { duration: number }) {
    try {
      await this.computerUse.action({ action: 'wait', duration });
      return { content: [{ type: 'text', text: 'waiting done' }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error waiting: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_screenshot',
    description: 'Captures a screenshot of the current screen.',
  })
  async screenshot() {
    try {
      const shot = (await this.computerUse.action({
        action: 'screenshot',
      })) as { image: string };
      return {
        content: [
          {
            type: 'image',
            data: await compressPngBase64Under1MB(shot.image),
            mimeType: 'image/png',
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error taking screenshot: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_cursor_position',
    description: 'Gets the current (x, y) coordinates of the mouse cursor.',
  })
  async cursorPosition() {
    try {
      const pos = (await this.computerUse.action({
        action: 'cursor_position',
      })) as { x: number; y: number };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(pos),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting cursor position: ${(err as Error).message}`,
          },
        ],
      };
    }
  }
}
