import { Injectable } from '@nestjs/common';
import { Tool } from '@rekog/mcp-nest';
import { z } from 'zod';
import {
  ElementDetectorService,
  DetectedElement,
  BoundingBox,
} from '@bytebot/cv';
import { ComputerUseService } from '../computer-use/computer-use.service';
import { compressPngBase64Under1MB } from './compressor';

@Injectable()
export class ComputerUseTools {
  private readonly elementDetector = new ElementDetectorService();
  private readonly detectedElements = new Map<
    string,
    { element: DetectedElement; timestamp: number }
  >();
  private readonly elementCacheTtlMs = 5 * 60 * 1000;

  constructor(private readonly computerUse: ComputerUseService) {}

  private pruneDetectedElements(): void {
    const now = Date.now();
    for (const [id, cached] of this.detectedElements.entries()) {
      if (now - cached.timestamp > this.elementCacheTtlMs) {
        this.detectedElements.delete(id);
      }
    }
  }

  private cacheDetectedElements(elements: DetectedElement[]): void {
    const timestamp = Date.now();
    for (const element of elements) {
      this.detectedElements.set(element.id, { element, timestamp });
    }
  }

  private static formatDetectedElement(element: DetectedElement) {
    return {
      id: element.id,
      type: element.type,
      confidence: element.confidence,
      text: element.text ?? null,
      description: element.description,
      coordinates: {
        x: element.coordinates.x,
        y: element.coordinates.y,
        width: element.coordinates.width,
        height: element.coordinates.height,
        centerX: element.coordinates.centerX,
        centerY: element.coordinates.centerY,
      },
      metadata: element.metadata,
    };
  }

  private normalizeRegion(region: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): BoundingBox {
    return {
      ...region,
      centerX: region.x + region.width / 2,
      centerY: region.y + region.height / 2,
    };
  }

  @Tool({
    name: 'computer_detect_elements',
    description:
      'Detects interactive UI elements on the current screen using OCR and CV heuristics.',
    parameters: z.object({
      description: z
        .string()
        .min(1)
        .describe(
          'Description of the UI element to find (e.g., "Install button", "username field", "Save link")',
        ),
      region: z
        .object({
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
        })
        .optional()
        .describe('Optional region to search within'),
      includeAll: z
        .boolean()
        .optional()
        .describe('Return all detected elements, not just those matching description'),
    }),
  })
  async detectElements({
    description,
    region,
    includeAll = false,
  }: {
    description: string;
    region?: { x: number; y: number; width: number; height: number };
    includeAll?: boolean;
  }) {
    try {
      this.pruneDetectedElements();

      const screenshot = (await this.computerUse.action({
        action: 'screenshot',
        gridOverlay: false,
        highlightRegions: false,
        showCursor: false,
      })) as { image: string };

      const buffer = Buffer.from(screenshot.image, 'base64');

      const searchRegion = region ? this.normalizeRegion(region) : undefined;

      const detectionConfig = {
        enableOCR: true,
        enableTemplateMatching: false,
        enableEdgeDetection: true,
        confidenceThreshold: 0.5,
        ...(searchRegion ? { searchRegion } : {}),
      };

      const elements = await this.elementDetector.detectElements(
        buffer,
        detectionConfig,
      );
      this.cacheDetectedElements(elements);

      const trimmedDescription = description.trim();

      let resolvedElements: DetectedElement[] = elements;
      if (!includeAll) {
        const match = await this.elementDetector.findElementByDescription(
          elements,
          trimmedDescription,
        );
        resolvedElements = match ? [match] : [];
      }

      const serializable = resolvedElements.map((element) =>
        ComputerUseTools.formatDetectedElement(element),
      );

      const summaryText = includeAll
        ? `Detected ${serializable.length} element(s) across the screen.`
        : serializable.length > 0
          ? `Detected ${serializable.length} matching element(s) for "${trimmedDescription}" out of ${elements.length} detected. Use these element_id values for computer_click_element.`
          : elements.length === 0
            ? `No UI elements detected for description "${trimmedDescription}".`
            : `No elements matched description "${trimmedDescription}". ${elements.length} element(s) detected overall.`;

      const payload = {
        description: trimmedDescription,
        includeAll,
        count: serializable.length,
        total_detected: elements.length,
        elements: serializable,
        timestamp: new Date().toISOString(),
        ...(searchRegion ? { region: searchRegion } : {}),
      };

      return {
        content: [
          {
            type: 'text',
            text: summaryText,
          },
          {
            type: 'text',
            text: JSON.stringify(payload),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error detecting elements: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_click_element',
    description:
      'Clicks a previously detected UI element by identifier using cached coordinates.',
    parameters: z.object({
      element_id: z
        .string()
        .min(1)
        .describe('Identifier of the detected element to click.'),
    }),
  })
  async clickElement({ element_id }: { element_id: string }) {
    try {
      this.pruneDetectedElements();
      const cached = this.detectedElements.get(element_id);

      if (!cached) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: element ${element_id} not found. Run computer_detect_elements first.`,
            },
          ],
        };
      }

      const clickTarget = await this.elementDetector.getClickCoordinates(
        cached.element,
      );

      await this.computerUse.action({
        action: 'click_mouse',
        coordinates: clickTarget.coordinates,
        button: 'left',
        clickCount: 1,
        description: cached.element.description,
        context: {
          targetDescription: cached.element.description,
          source: 'smart_focus',
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              element_id,
              coordinates_used: clickTarget.coordinates,
              confidence: cached.element.confidence,
              detection_method: clickTarget.method,
              element_text: cached.element.text ?? null,
            }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error clicking element ${element_id}: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

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
      clickCount: z
        .number()
        .describe('Number of clicks to perform (e.g., 2 for double-click).'),
      description: z
        .string()
        .optional()
        .describe(
          'Optional description of the intended target (e.g., "Submit button"). When provided, the smart focus system can locate the element automatically.',
        ),
      context: z
        .object({
          region: z
            .object({
              x: z.number(),
              y: z.number(),
              width: z.number(),
              height: z.number(),
            })
            .optional(),
          zoomLevel: z.number().optional(),
          targetDescription: z.string().optional(),
          source: z
            .enum([
              'manual',
              'smart_focus',
              'progressive_zoom',
              'binary_search',
            ])
            .optional(),
        })
        .optional()
        .describe(
          'Optional telemetry context including region bounds, zoom level, and origin of the click request.',
        ),
    }),
  })
  async clickMouse({
    coordinates,
    button,
    holdKeys,
    clickCount,
    description,
    context,
  }: {
    coordinates?: { x: number; y: number };
    button: 'left' | 'right' | 'middle';
    holdKeys?: string[];
    clickCount: number;
    description?: string;
    context?: {
      region?: { x: number; y: number; width: number; height: number };
      zoomLevel?: number;
      targetDescription?: string;
      source?: 'manual' | 'smart_focus' | 'progressive_zoom' | 'binary_search';
    };
  }) {
    try {
      await this.computerUse.action({
        action: 'click_mouse',
        coordinates,
        button,
        holdKeys,
        clickCount,
        description,
        context,
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
      scrollCount: z
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
    scrollCount,
    holdKeys,
  }: {
    coordinates?: { x: number; y: number };
    direction: 'up' | 'down' | 'left' | 'right';
    scrollCount: number;
    holdKeys?: string[];
  }) {
    try {
      await this.computerUse.action({
        action: 'scroll',
        coordinates,
        direction,
        scrollCount,
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
    description: `Simulates typing a sequence of keys, often used for shortcuts involving modifier keys (e.g., Ctrl+C). Presses and releases each key in order.
    
────────────────────────
VALID KEYS
────────────────────────
A, Add, AudioForward, AudioMute, AudioNext, AudioPause, AudioPlay, AudioPrev, AudioRandom, AudioRepeat, AudioRewind, AudioStop, AudioVolDown, AudioVolUp,  
B, Backslash, Backspace,  
C, CapsLock, Clear, Comma,  
D, Decimal, Delete, Divide, Down,  
E, End, Enter, Equal, Escape, F,  
F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12, F13, F14, F15, F16, F17, F18, F19, F20, F21, F22, F23, F24,  
Fn,  
G, Grave,  
H, Home,  
I, Insert,  
J, K, L, Left, LeftAlt, LeftBracket, LeftCmd, LeftControl, LeftShift, LeftSuper, LeftWin,  
M, Menu, Minus, Multiply,  
N, Num0, Num1, Num2, Num3, Num4, Num5, Num6, Num7, Num8, Num9, NumLock,  
NumPad0, NumPad1, NumPad2, NumPad3, NumPad4, NumPad5, NumPad6, NumPad7, NumPad8, NumPad9,  
O, P, PageDown, PageUp, Pause, Period, Print,  
Q, Quote,  
R, Return, Right, RightAlt, RightBracket, RightCmd, RightControl, RightShift, RightSuper, RightWin,  
S, ScrollLock, Semicolon, Slash, Space, Subtract,  
T, Tab,  
U, Up,  
V, W, X, Y, Z`,
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
    description: `Simulates pressing down or releasing specific keys. Useful for holding modifier keys.     
────────────────────────
VALID KEYS
────────────────────────
A, Add, AudioForward, AudioMute, AudioNext, AudioPause, AudioPlay, AudioPrev, AudioRandom, AudioRepeat, AudioRewind, AudioStop, AudioVolDown, AudioVolUp,  
B, Backslash, Backspace,  
C, CapsLock, Clear, Comma,  
D, Decimal, Delete, Divide, Down,  
E, End, Enter, Equal, Escape, F,  
F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12, F13, F14, F15, F16, F17, F18, F19, F20, F21, F22, F23, F24,  
Fn,  
G, Grave,  
H, Home,  
I, Insert,  
J, K, L, Left, LeftAlt, LeftBracket, LeftCmd, LeftControl, LeftShift, LeftSuper, LeftWin,  
M, Menu, Minus, Multiply,  
N, Num0, Num1, Num2, Num3, Num4, Num5, Num6, Num7, Num8, Num9, NumLock,  
NumPad0, NumPad1, NumPad2, NumPad3, NumPad4, NumPad5, NumPad6, NumPad7, NumPad8, NumPad9,  
O, P, PageDown, PageUp, Pause, Period, Print,  
Q, Quote,  
R, Return, Right, RightAlt, RightBracket, RightCmd, RightControl, RightShift, RightSuper, RightWin,  
S, ScrollLock, Semicolon, Slash, Space, Subtract,  
T, Tab,  
U, Up,  
V, W, X, Y, Z  
      `,
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
    description:
      'Types a string of text character by character. Use this tool for strings less than 25 characters, or passwords/sensitive form fields.',
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
    name: 'computer_paste_text',
    description:
      'Copies text to the clipboard and pastes it. Use this tool for typing long text strings or special characters not on the standard keyboard.',
    parameters: z.object({
      text: z.string().describe('The text string to paste.'),
    }),
  })
  async pasteText({ text }: { text: string }) {
    try {
      await this.computerUse.action({ action: 'paste_text', text });
      return { content: [{ type: 'text', text: 'text pasted' }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error pasting text: ${(err as Error).message}`,
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
    name: 'computer_application',
    description:
      'Opens or switches to the specified application and maximizes it.',
    parameters: z.object({
      application: z.enum([
        'firefox',
        '1password',
        'thunderbird',
        'vscode',
        'terminal',
        'desktop',
        'directory',
      ]),
    }),
  })
  async application({
    application,
  }: {
    application:
      | 'firefox'
      | '1password'
      | 'thunderbird'
      | 'vscode'
      | 'terminal'
      | 'desktop'
      | 'directory';
  }) {
    try {
      await this.computerUse.action({ action: 'application', application });
      return { content: [{ type: 'text', text: 'application opened' }] };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error opening application: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_screenshot',
    description: 'Captures a screenshot of the current screen.',
    parameters: z
      .object({
        gridOverlay: z.boolean().optional(),
        gridSize: z.number().optional(),
        highlightRegions: z.boolean().optional(),
        showCursor: z.boolean().optional(),
        progressStep: z.number().optional(),
        progressMessage: z.string().optional(),
        progressTaskId: z.string().optional(),
        markTarget: z
          .object({
            coordinates: z.object({ x: z.number(), y: z.number() }),
            label: z.string().optional(),
          })
          .optional(),
      })
      .optional(),
  })
  async screenshot({
    gridOverlay,
    gridSize,
    highlightRegions,
    showCursor,
    progressStep,
    progressMessage,
    progressTaskId,
    markTarget,
  }: {
    gridOverlay?: boolean;
    gridSize?: number;
    highlightRegions?: boolean;
    showCursor?: boolean;
    progressStep?: number;
    progressMessage?: string;
    progressTaskId?: string;
    markTarget?: { coordinates: { x: number; y: number }; label?: string };
  } = {}) {
    try {
      const shot = (await this.computerUse.action({
        action: 'screenshot',
        gridOverlay,
        gridSize,
        highlightRegions,
        showCursor,
        progressStep,
        progressMessage,
        progressTaskId,
        markTarget,
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
    name: 'computer_screenshot_region',
    description:
      'Captures a focused screenshot of a predefined 3x3 screen region with an optional finer grid.',
    parameters: z.object({
      region: z.enum([
        'top-left',
        'top-center',
        'top-right',
        'middle-left',
        'middle-center',
        'middle-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ]),
      gridSize: z
        .number()
        .optional()
        .describe('Optional grid spacing in pixels for the focused view.'),
      enhance: z
        .boolean()
        .optional()
        .describe('Apply sharpening and contrast enhancement to the capture.'),
      includeOffset: z
        .boolean()
        .optional()
        .describe('Include global coordinate offsets in the grid labels.'),
      addHighlight: z
        .boolean()
        .optional()
        .describe('Highlight this region in the output.'),
      showCursor: z.boolean().optional(),
      progressStep: z.number().optional(),
      progressMessage: z.string().optional(),
      progressTaskId: z.string().optional(),
    }),
  })
  async screenshotRegion({
    region,
    gridSize,
    enhance,
    includeOffset,
    addHighlight,
    showCursor,
    progressStep,
    progressMessage,
    progressTaskId,
  }: {
    region:
      | 'top-left'
      | 'top-center'
      | 'top-right'
      | 'middle-left'
      | 'middle-center'
      | 'middle-right'
      | 'bottom-left'
      | 'bottom-center'
      | 'bottom-right';
    gridSize?: number;
    enhance?: boolean;
    includeOffset?: boolean;
    addHighlight?: boolean;
    showCursor?: boolean;
    progressStep?: number;
    progressMessage?: string;
    progressTaskId?: string;
  }) {
    try {
      const shot = (await this.computerUse.action({
        action: 'screenshot_region',
        region,
        gridSize,
        enhance,
        includeOffset,
        addHighlight,
        showCursor,
        progressStep,
        progressMessage,
        progressTaskId,
      })) as { image: string; offset: { x: number; y: number } };

      return {
        content: [
          {
            type: 'image',
            data: await compressPngBase64Under1MB(shot.image),
            mimeType: 'image/png',
          },
          {
            type: 'text',
            text: JSON.stringify({ offset: shot.offset }),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error taking focused region screenshot: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_screenshot_custom_region',
    description:
      'Captures a custom rectangular region of the screen with a fine grid overlay and global coordinates.',
    parameters: z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      gridSize: z
        .number()
        .optional()
        .describe('Optional grid spacing in pixels for the custom capture.'),
      showCursor: z.boolean().optional(),
    }),
  })
  async screenshotCustomRegion({
    x,
    y,
    width,
    height,
    gridSize,
    showCursor,
  }: {
    x: number;
    y: number;
    width: number;
    height: number;
    gridSize?: number;
    showCursor?: boolean;
  }) {
    try {
      const shot = (await this.computerUse.action({
        action: 'screenshot_custom_region',
        x,
        y,
        width,
        height,
        gridSize,
        showCursor,
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
            text: `Error taking custom region screenshot: ${(err as Error).message}`,
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

  @Tool({
    name: 'computer_write_file',
    description:
      'Writes a file to the specified path with base64 encoded data.',
    parameters: z.object({
      path: z
        .string()
        .describe('The file path where the file should be written.'),
      data: z.string().describe('Base64 encoded file data to write.'),
    }),
  })
  async writeFile({ path, data }: { path: string; data: string }) {
    try {
      const result = await this.computerUse.action({
        action: 'write_file',
        path,
        data,
      });
      return {
        content: [
          {
            type: 'text',
            text: result.message || 'File written successfully',
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error writing file: ${(err as Error).message}`,
          },
        ],
      };
    }
  }

  @Tool({
    name: 'computer_read_file',
    description:
      'Reads a file from the specified path and returns it as a document content block with base64 encoded data.',
    parameters: z.object({
      path: z.string().describe('The file path to read from.'),
    }),
  })
  async readFile({ path }: { path: string }) {
    try {
      const result = await this.computerUse.action({
        action: 'read_file',
        path,
      });

      if (result.success && result.data) {
        // Return document content block
        return {
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: result.mediaType || 'application/octet-stream',
                data: result.data,
              },
              name: result.name || 'file',
              size: result.size,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: result.message || 'Error reading file',
            },
          ],
        };
      }
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Error reading file: ${(err as Error).message}`,
          },
        ],
      };
    }
  }
}
