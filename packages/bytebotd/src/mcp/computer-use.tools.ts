import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import { ComputerUseService } from '../computer-use/computer-use.service';
import { MessageContentType } from '@bytebot/shared';

@Injectable()
export class ComputerUseTools {
  constructor(private readonly computerUse: ComputerUseService) {}

  @Tool({
    name: 'computer_move_mouse',
    description: 'Move the mouse to specific coordinates.',
    parameters: z.object({
      coordinates: z.object({ x: z.number(), y: z.number() }),
    }),
  })
  async moveMouse({ coordinates }: { coordinates: { x: number; y: number } }) {
    try {
      await this.computerUse.action({ action: 'move_mouse', coordinates });
      return { content: [{ type: MessageContentType.Text, text: 'mouse moved' }] };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error moving mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_trace_mouse',
    description: 'Trace a path with the mouse.',
    parameters: z.object({
      path: z.array(z.object({ x: z.number(), y: z.number() })),
      holdKeys: z.array(z.string()).optional(),
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
        content: [{ type: MessageContentType.Text, text: 'mouse traced' }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error tracing mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_click_mouse',
    description: 'Perform mouse clicks.',
    parameters: z.object({
      coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
      button: z.enum(['left', 'right', 'middle']),
      holdKeys: z.array(z.string()).optional(),
      numClicks: z.number(),
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
        content: [{ type: MessageContentType.Text, text: 'mouse clicked' }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error clicking mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_press_mouse',
    description: 'Press or release a mouse button.',
    parameters: z.object({
      coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
      button: z.enum(['left', 'right', 'middle']),
      press: z.enum(['down', 'up']),
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
        content: [{ type: MessageContentType.Text, text: 'mouse pressed' }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error pressing mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_drag_mouse',
    description: 'Drag the mouse along a path.',
    parameters: z.object({
      path: z.array(z.object({ x: z.number(), y: z.number() })),
      button: z.enum(['left', 'right', 'middle']),
      holdKeys: z.array(z.string()).optional(),
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
        content: [{ type: MessageContentType.Text, text: 'mouse dragged' }],
      };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error dragging mouse: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_scroll',
    description: 'Scroll the mouse wheel.',
    parameters: z.object({
      coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
      direction: z.enum(['up', 'down', 'left', 'right']),
      numScrolls: z.number(),
      holdKeys: z.array(z.string()).optional(),
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
      return { content: [{ type: MessageContentType.Text, text: 'scrolled' }] };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error scrolling: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_type_keys',
    description: 'Press a sequence of keys.',
    parameters: z.object({
      keys: z.array(z.string()),
      delay: z.number().optional(),
    }),
  })
  async typeKeys({ keys, delay }: { keys: string[]; delay?: number }) {
    try {
      await this.computerUse.action({ action: 'type_keys', keys, delay });
      return { content: [{ type: MessageContentType.Text, text: 'keys typed' }] };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error typing keys: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_press_keys',
    description: 'Hold or release keys.',
    parameters: z.object({
      keys: z.array(z.string()),
      press: z.enum(['down', 'up']),
    }),
  })
  async pressKeys({ keys, press }: { keys: string[]; press: 'down' | 'up' }) {
    try {
      await this.computerUse.action({ action: 'press_keys', keys, press });
      return { content: [{ type: MessageContentType.Text, text: 'keys pressed' }] };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error pressing keys: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_type_text',
    description: 'Type a text string.',
    parameters: z.object({
      text: z.string(),
      delay: z.number().optional(),
    }),
  })
  async typeText({ text, delay }: { text: string; delay?: number }) {
    try {
      await this.computerUse.action({ action: 'type_text', text, delay });
      return { content: [{ type: MessageContentType.Text, text: 'text typed' }] };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error typing text: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_wait',
    description: 'Wait for a period of time.',
    parameters: z.object({ duration: z.number() }),
  })
  async wait({ duration }: { duration: number }) {
    try {
      await this.computerUse.action({ action: 'wait', duration });
      return { content: [{ type: MessageContentType.Text, text: 'waiting done' }] };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error waiting: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_screenshot',
    description: 'Capture a screenshot of the desktop.',
  })
  async screenshot() {
    try {
      const shot = (await this.computerUse.action({
        action: 'screenshot',
      })) as { image: string };
      return {
        content: [
          {
            type: MessageContentType.Image,
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: shot.image,
            },
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error taking screenshot: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_cursor_position',
    description: 'Get the current cursor position.',
  })
  async cursorPosition() {
    try {
      const pos = (await this.computerUse.action({
        action: 'cursor_position',
      })) as { x: number; y: number };
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: JSON.stringify(pos),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: MessageContentType.Text,
            text: `Error getting cursor position: ${(err as Error).message}`,
          },
        ],
      };
    }
  }
}
