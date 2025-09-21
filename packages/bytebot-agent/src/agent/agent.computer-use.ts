import {
  Button,
  Coordinates,
  Press,
  ComputerToolUseContentBlock,
  MessageContentBlock,
  ToolResultContentBlock,
  MessageContentType,
  isScreenshotToolUseBlock,
  isScreenshotRegionToolUseBlock,
  isScreenshotCustomRegionToolUseBlock,
  isCursorPositionToolUseBlock,
  isMoveMouseToolUseBlock,
  isTraceMouseToolUseBlock,
  isClickMouseToolUseBlock,
  isPressMouseToolUseBlock,
  isDragMouseToolUseBlock,
  isScrollToolUseBlock,
  isTypeKeysToolUseBlock,
  isPressKeysToolUseBlock,
  isTypeTextToolUseBlock,
  isWaitToolUseBlock,
  isApplicationToolUseBlock,
  isPasteTextToolUseBlock,
  isReadFileToolUseBlock,
  isScreenInfoToolUseBlock,
  ClickContext,
} from '@bytebot/shared';
import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { SmartClickAI, SmartClickHelper } from './smart-click.helper';

interface ScreenshotOptions {
  gridOverlay?: boolean;
  gridSize?: number;
  highlightRegions?: boolean;
  showCursor?: boolean;
  progressStep?: number;
  progressMessage?: string;
  progressTaskId?: string;
  markTarget?: {
    coordinates: Coordinates;
    label?: string;
  };
}

interface ScreenshotResponse {
  image: string;
  offset?: { x: number; y: number };
  region?: { x: number; y: number; width: number; height: number };
  zoomLevel?: number;
}

const BYTEBOT_DESKTOP_BASE_URL = process.env.BYTEBOT_DESKTOP_BASE_URL as string;
const BYTEBOT_LLM_PROXY_URL = process.env.BYTEBOT_LLM_PROXY_URL as
  | string
  | undefined;
const SMART_FOCUS_MODEL =
  process.env.BYTEBOT_SMART_FOCUS_MODEL || 'gpt-4o-mini';
const SMART_FOCUS_ENABLED = process.env.BYTEBOT_SMART_FOCUS !== 'false';

export async function handleComputerToolUse(
  block: ComputerToolUseContentBlock,
  logger: Logger,
): Promise<ToolResultContentBlock> {
  logger.debug(
    `Handling computer tool use: ${block.name}, tool_use_id: ${block.id}`,
  );

  if (isScreenshotToolUseBlock(block)) {
    logger.debug('Processing screenshot request');
    try {
      const { image } = await screenshot();
      logger.debug('Screenshot captured successfully');

      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Image,
            source: {
              data: image,
              media_type: 'image/png',
              type: 'base64',
            },
          },
        ],
      };
    } catch (error) {
      logger.error(`Screenshot failed: ${error.message}`, error.stack);
      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: 'ERROR: Failed to take screenshot',
          },
        ],
        is_error: true,
      };
    }
  }

  if (isScreenshotRegionToolUseBlock(block)) {
    logger.debug('Processing focused region screenshot request');
    try {
      const { image, offset, region, zoomLevel } = await screenshotRegion(
        block.input,
      );
      const content: MessageContentBlock[] = [
        {
          type: MessageContentType.Image,
          source: {
            data: image,
            media_type: 'image/png',
            type: 'base64',
          },
        },
      ];

      // Provide explicit numeric context to help models compute global coordinates
      const meta: Record<string, any> = {};
      if (offset) meta.offset = offset;
      if (region) meta.region = region;
      if (typeof zoomLevel === 'number') meta.zoomLevel = zoomLevel;
      content.push({
        type: MessageContentType.Text,
        text: `Focused region metadata: ${JSON.stringify(meta)}. Note: grid labels in the image are global screen coordinates. Use them (not local pixels) when computing click positions.`,
      });

      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content,
      };
    } catch (error) {
      logger.error(
        `Focused region screenshot failed: ${error.message}`,
        error.stack,
      );
      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: 'ERROR: Failed to capture focused region screenshot',
          },
        ],
        is_error: true,
      };
    }
  }

  if (isScreenshotCustomRegionToolUseBlock(block)) {
    logger.debug('Processing custom region screenshot request');
    try {
      const { image } = await screenshotCustomRegion(block.input);
      const meta = {
        region: {
          x: block.input.x,
          y: block.input.y,
          width: block.input.width,
          height: block.input.height,
        },
        gridSize: block.input.gridSize ?? null,
      };
      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Image,
            source: {
              data: image,
              media_type: 'image/png',
              type: 'base64',
            },
          },
          {
            type: MessageContentType.Text,
            text: `Custom region metadata: ${JSON.stringify(meta)}. Grid labels are global; compute clicks in global coordinates.`,
          },
        ],
      };
    } catch (error) {
      logger.error(
        `Custom region screenshot failed: ${error.message}`,
        error.stack,
      );
      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: 'ERROR: Failed to capture custom region screenshot',
          },
        ],
        is_error: true,
      };
    }
  }

  if (isCursorPositionToolUseBlock(block)) {
    logger.debug('Processing cursor position request');
    try {
      logger.debug('Getting cursor position');
      const position = await cursorPosition();
      logger.debug(`Cursor position obtained: ${position.x}, ${position.y}`);

      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: `Cursor position: ${position.x}, ${position.y}`,
          },
        ],
      };
    } catch (error) {
      logger.error(
        `Getting cursor position failed: ${error.message}`,
        error.stack,
      );
      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: 'ERROR: Failed to get cursor position',
          },
        ],
        is_error: true,
      };
    }
  }

  if (isScreenInfoToolUseBlock(block)) {
    logger.debug('Processing screen info request');
    try {
      const info = await screenInfo();
      logger.debug(`Screen info obtained: ${info.width}x${info.height}`);

      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: `Screen size: ${info.width} x ${info.height}`,
          },
        ],
      };
    } catch (error) {
      logger.error(
        `Getting screen info failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        type: MessageContentType.ToolResult,
        tool_use_id: block.id,
        content: [
          {
            type: MessageContentType.Text,
            text: 'ERROR: Failed to get screen info',
          },
        ],
        is_error: true,
      };
    }
  }

  try {
    let postClickVerifyImage: string | null = null;
    if (isMoveMouseToolUseBlock(block)) {
      await moveMouse(block.input);
    }
    if (isTraceMouseToolUseBlock(block)) {
      await traceMouse(block.input);
    }
    if (isClickMouseToolUseBlock(block)) {
      const clickMeta = await performClick(block.input);

      // Optional post-click verification: capture a zoomed region around the click with a target marker
      try {
        const verifyEnabled = process.env.BYTEBOT_CLICK_VERIFY === 'true';
        if (verifyEnabled) {
          const R = Number.parseInt(
            process.env.BYTEBOT_CLICK_VERIFY_RADIUS || '160',
            10,
          );
          const zoom = Number.parseFloat(
            process.env.BYTEBOT_CLICK_VERIFY_ZOOM || '2.0',
          );

          let coords = clickMeta?.coordinates;
          if (!coords) {
            try {
              coords = await cursorPosition();
            } catch (err) {
              console.warn(
                'Unable to get cursor position for verification:',
                err,
              );
            }
          }

          if (coords) {
            const x = Math.max(0, coords.x - R);
            const y = Math.max(0, coords.y - R);
            const width = Math.max(50, R * 2);
            const height = Math.max(50, R * 2);

            const verifyShot = await screenshotCustomRegion({
              x,
              y,
              width,
              height,
              gridSize: 25,
              zoomLevel: zoom,
              markTarget: { coordinates: coords },
              progressMessage: 'Post-click verification',
            });
            postClickVerifyImage = verifyShot.image;
          }
        }
      } catch (e) {
        console.warn('Post-click verification failed:', e);
      }
    }
    if (isPressMouseToolUseBlock(block)) {
      await pressMouse(block.input);
    }
    if (isDragMouseToolUseBlock(block)) {
      await dragMouse(block.input);
    }
    if (isScrollToolUseBlock(block)) {
      await scroll(block.input);
    }
    if (isTypeKeysToolUseBlock(block)) {
      await typeKeys(block.input);
    }
    if (isPressKeysToolUseBlock(block)) {
      await pressKeys(block.input);
    }
    if (isTypeTextToolUseBlock(block)) {
      await typeText(block.input);
    }
    if (isPasteTextToolUseBlock(block)) {
      await pasteText(block.input);
    }
    if (isWaitToolUseBlock(block)) {
      await wait(block.input);
    }
    if (isApplicationToolUseBlock(block)) {
      await application(block.input);
    }
    if (isReadFileToolUseBlock(block)) {
      logger.debug(`Reading file: ${block.input.path}`);
      const result = await readFile(block.input);

      if (result.success && result.data) {
        // Return document content block
        return {
          type: MessageContentType.ToolResult,
          tool_use_id: block.id,
          content: [
            {
              type: MessageContentType.Document,
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
        // Return error message
        return {
          type: MessageContentType.ToolResult,
          tool_use_id: block.id,
          content: [
            {
              type: MessageContentType.Text,
              text: result.message || 'Error reading file',
            },
          ],
          is_error: true,
        };
      }
    }

    let screenshotResult: string | null = null;
    try {
      // Default: do NOT take a generic full screenshot unless explicitly opted in
      const wantFull = process.env.BYTEBOT_POST_ACTION_SCREENSHOT === 'true';
      const includeFullAfterVerify =
        process.env.BYTEBOT_INCLUDE_FULL_AFTER_VERIFY === 'true';

      if (wantFull && (!postClickVerifyImage || includeFullAfterVerify)) {
        // Wait before taking screenshot to allow UI to settle
        const delayMs = 750; // 750ms delay
        logger.debug(`Waiting ${delayMs}ms before taking screenshot`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        logger.debug(
          'Taking screenshot after tool execution (gridOverlay=true)',
        );
        screenshotResult = (await screenshot({ gridOverlay: true })).image;
        logger.debug('Screenshot captured successfully');
      }
    } catch (error) {
      logger.error('Failed to take screenshot', error);
    }

    logger.debug(`Tool execution successful for tool_use_id: ${block.id}`);
    const toolResult: ToolResultContentBlock = {
      type: MessageContentType.ToolResult,
      tool_use_id: block.id,
      content: [
        {
          type: MessageContentType.Text,
          text: 'Tool executed successfully',
        },
      ],
    };

    if (postClickVerifyImage) {
      toolResult.content.push({
        type: MessageContentType.Image,
        source: {
          data: postClickVerifyImage,
          media_type: 'image/png',
          type: 'base64',
        },
      });
    }
    if (screenshotResult) {
      toolResult.content.push({
        type: MessageContentType.Image,
        source: {
          data: screenshotResult,
          media_type: 'image/png',
          type: 'base64',
        },
      });
    }

    return toolResult;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(
      `Error executing ${block.name} tool: ${msg}`,
      (error as any)?.stack,
    );
    const friendly =
      block.name === 'computer_click_mouse' && msg.startsWith('Click rejected:')
        ? 'Click rejected: provide coordinates or a short target description so Smart Focus can compute exact coordinates.'
        : `Error executing ${block.name} tool: ${msg}`;
    return {
      type: MessageContentType.ToolResult,
      tool_use_id: block.id,
      content: [
        {
          type: MessageContentType.Text,
          text: friendly,
        },
      ],
      is_error: true,
    };
  }
}

async function moveMouse(input: { coordinates: Coordinates }): Promise<void> {
  const { coordinates } = input;
  console.log(
    `Moving mouse to coordinates: [${coordinates.x}, ${coordinates.y}]`,
  );

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'move_mouse',
        coordinates,
      }),
    });
  } catch (error) {
    console.error('Error in move_mouse action:', error);
    throw error;
  }
}

async function traceMouse(input: {
  path: Coordinates[];
  holdKeys?: string[];
}): Promise<void> {
  const { path, holdKeys } = input;
  console.log(
    `Tracing mouse to path: ${path} ${holdKeys ? `with holdKeys: ${holdKeys}` : ''}`,
  );

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'trace_mouse',
        path,
        holdKeys,
      }),
    });
  } catch (error) {
    console.error('Error in trace_mouse action:', error);
    throw error;
  }
}

type ClickInput = {
  coordinates?: Coordinates;
  button: Button;
  holdKeys?: string[];
  clickCount: number;
  description?: string;
  context?: ClickContext;
};

async function performClick(
  input: ClickInput,
): Promise<{ coordinates?: Coordinates; context?: ClickContext } | null> {
  const { coordinates, description } = input;
  const baseContext =
    input.context ??
    (description
      ? {
          targetDescription: description,
          source: 'manual' as const,
        }
      : undefined);

  if (coordinates) {
    await clickMouse({ ...input, context: baseContext });
    return { coordinates, context: baseContext };
  }

  const trimmedDescription = description?.trim();
  const requireDesc = process.env.BYTEBOT_REQUIRE_CLICK_DESCRIPTION !== 'false';
  if (!trimmedDescription && !coordinates && requireDesc) {
    throw new Error(
      'Click rejected: provide coordinates or a short target description to enable Smart Focus.',
    );
  }
  if (!trimmedDescription && !coordinates) {
    console.warn(
      '[SmartFocus] No coordinates or description provided; proceeding with direct click at current cursor position.',
    );
    await clickMouse({ ...input, context: baseContext });
    return null;
  }

  const helper = getSmartClickHelper();

  if (!helper) {
    console.warn(
      '[SmartFocus] Helper unavailable (proxy URL or configuration missing); falling back to basic click.',
    );
    await clickMouse({ ...input, context: baseContext });
    return null;
  }

  const smartResult = await helper.performSmartClick(trimmedDescription!);
  if (smartResult) {
    await clickMouse({
      ...input,
      coordinates: smartResult.coordinates,
      context: smartResult.context,
    });
    return smartResult;
  }

  const binaryResult = await helper.binarySearchClick(trimmedDescription!);
  if (binaryResult) {
    await clickMouse({
      ...input,
      coordinates: binaryResult.coordinates,
      context: binaryResult.context,
    });
    return binaryResult;
  }

  await clickMouse({ ...input, context: baseContext });
  return null;
}

async function clickMouse(input: {
  coordinates?: Coordinates;
  button: Button;
  holdKeys?: string[];
  clickCount: number;
  description?: string;
  context?: ClickContext;
}): Promise<void> {
  const { coordinates, button, holdKeys, clickCount } = input;
  console.log(
    `Clicking mouse ${button} ${clickCount} times ${coordinates ? `at coordinates: [${coordinates.x}, ${coordinates.y}] ` : ''} ${holdKeys ? `with holdKeys: ${holdKeys}` : ''}`,
  );

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'click_mouse',
        coordinates,
        button,
        holdKeys: holdKeys && holdKeys.length > 0 ? holdKeys : undefined,
        clickCount,
        description: input.description ?? undefined,
        context: input.context ?? undefined,
      }),
    });
  } catch (error) {
    console.error('Error in click_mouse action:', error);
    throw error;
  }
}

let cachedSmartClickHelper: SmartClickHelper | null | undefined = undefined;

function getSmartClickHelper(): SmartClickHelper | null {
  if (!SMART_FOCUS_ENABLED) {
    return null;
  }

  if (cachedSmartClickHelper !== undefined) {
    return cachedSmartClickHelper;
  }

  cachedSmartClickHelper = createSmartClickHelper();
  return cachedSmartClickHelper;
}

function createSmartClickHelper(): SmartClickHelper | null {
  const ai = createSmartClickAI();
  if (!ai) {
    return null;
  }

  const screenshotFn = async (options?: ScreenshotOptions) => {
    return screenshot(options);
  };

  const screenshotRegionFn = async (options: {
    region: string;
    gridSize?: number;
    enhance?: boolean;
    includeOffset?: boolean;
    addHighlight?: boolean;
    progressStep?: number;
    progressMessage?: string;
    progressTaskId?: string;
  }) => {
    return screenshotRegion(options);
  };

  const screenshotCustomRegionFn = async (options: {
    x: number;
    y: number;
    width: number;
    height: number;
    gridSize?: number;
  }) => {
    return screenshotCustomRegion(options);
  };

  return new SmartClickHelper(
    ai,
    screenshotFn,
    screenshotRegionFn,
    screenshotCustomRegionFn,
    {
      proxyUrl: BYTEBOT_LLM_PROXY_URL,
      model: SMART_FOCUS_MODEL,
    },
  );
}

export function createSmartClickAI(): SmartClickAI | null {
  if (!BYTEBOT_LLM_PROXY_URL) {
    console.warn(
      '[SmartFocus] BYTEBOT_LLM_PROXY_URL not set; smart focus disabled.',
    );
    return null;
  }

  const openai = new OpenAI({
    apiKey: 'dummy-key-for-proxy',
    baseURL: BYTEBOT_LLM_PROXY_URL,
  });

  return {
    async askAboutScreenshot(image: string, prompt: string): Promise<string> {
      const response = await openai.chat.completions.create({
        model: SMART_FOCUS_MODEL,
        temperature: 0,
        max_tokens: 64,
        messages: [
          {
            role: 'system',
            content:
              'You identify regions of a desktop screenshot. Reply exactly with the requested format.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt.trim(),
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${image}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
      });

      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error('Smart focus region identification returned no result');
      }

      const content = Array.isArray(message.content)
        ? message.content
            .map((part) =>
              typeof part === 'string' ? part : 'text' in part ? part.text : '',
            )
            .join('')
        : (message.content ?? '');

      return (content || '').trim();
    },

    async getCoordinates(
      image: string,
      prompt: string,
    ): Promise<{ x: number; y: number }> {
      const completion = await openai.chat.completions.create({
        model: SMART_FOCUS_MODEL,
        temperature: 0,
        max_tokens: 128,
        messages: [
          {
            role: 'system',
            content:
              'You provide exact screen coordinates. Reply ONLY with JSON: {"x":<number>,"y":<number>}.',
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `${prompt.trim()}\nRespond with JSON only.`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
      });

      const message = completion.choices[0]?.message;
      if (!message) {
        throw new Error(
          'Smart focus coordinate identification returned no result',
        );
      }

      const rawContent = Array.isArray(message.content)
        ? message.content
            .map((part) =>
              typeof part === 'string' ? part : 'text' in part ? part.text : '',
            )
            .join('')
        : (message.content ?? '');

      const parsed = parseCoordinateResponse(rawContent);
      if (!parsed) {
        throw new Error(
          `Unable to parse coordinates from smart focus response: ${rawContent}`,
        );
      }

      return parsed;
    },
  };
}

function extractAxisValue(response: string, axis: 'x' | 'y'): number | null {
  const normalizedAxis = axis.toLowerCase();
  const patterns = [
    new RegExp(
      `(?:global[_\\s]*${normalizedAxis}|${normalizedAxis}[_\\s]*global)\\s*[=:]\\s*(-?\\d+(?:\\.\\d+)?)`,
      'ig',
    ),
    new RegExp(
      `${normalizedAxis}\\s*[=:]\\s*global\\s*(-?\\d+(?:\\.\\d+)?)`,
      'ig',
    ),
    new RegExp(
      `${normalizedAxis}\\s*[=:]\\s*(-?\\d+(?:\\.\\d+)?)(?:\\s*\\(\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\))?`,
      'ig',
    ),
  ];

  for (const pattern of patterns) {
    const matches = Array.from(response.matchAll(pattern));
    if (matches.length === 0) {
      continue;
    }

    const lastMatch = matches[matches.length - 1];
    const candidate = lastMatch[2] ?? lastMatch[1];
    const value = Number.parseFloat(candidate);
    if (!Number.isNaN(value)) {
      return value;
    }
  }

  return null;
}

export function parseCoordinateResponse(
  response: string,
): { x: number; y: number } | null {
  const trimmed = response.trim();
  try {
    const json = JSON.parse(trimmed);
    if (typeof json.x === 'number' && typeof json.y === 'number') {
      return { x: Math.round(json.x), y: Math.round(json.y) };
    }
  } catch (error) {
    // Ignore JSON parse errors and fall through to regex parsing.
  }

  let xValue = extractAxisValue(trimmed, 'x');
  let yValue = extractAxisValue(trimmed, 'y');

  if (xValue != null && yValue != null) {
    return { x: Math.round(xValue), y: Math.round(yValue) };
  }

  const globalPairMatch = trimmed.match(
    /global[^\d-]*(-?\d+(?:\.\d+)?)[^\d-]+(-?\d+(?:\.\d+)?)/i,
  );
  if (globalPairMatch) {
    const globalX = Number.parseFloat(globalPairMatch[1]);
    const globalY = Number.parseFloat(globalPairMatch[2]);
    if (!Number.isNaN(globalX) && !Number.isNaN(globalY)) {
      if (xValue == null) {
        xValue = globalX;
      }
      if (yValue == null) {
        yValue = globalY;
      }
      if (xValue != null && yValue != null) {
        return { x: Math.round(xValue), y: Math.round(yValue) };
      }
    }
  }

  const numericMatches = trimmed.match(/-?\d+(?:\.\d+)?/g);
  if (!numericMatches || numericMatches.length < 2) {
    return null;
  }

  const numericValues = numericMatches
    .map((value) => Number.parseFloat(value))
    .filter((value) => !Number.isNaN(value));

  if (numericValues.length < 2) {
    return null;
  }

  if (xValue == null || yValue == null) {
    const [fallbackX, fallbackY] = numericValues.slice(-2);
    if (xValue == null) {
      xValue = fallbackX;
    }
    if (yValue == null) {
      yValue = fallbackY;
    }
  }

  if (xValue == null || yValue == null) {
    return null;
  }

  return { x: Math.round(xValue), y: Math.round(yValue) };
}

async function pressMouse(input: {
  coordinates?: Coordinates;
  button: Button;
  press: Press;
}): Promise<void> {
  const { coordinates, button, press } = input;
  console.log(
    `Pressing mouse ${button} ${press} ${coordinates ? `at coordinates: [${coordinates.x}, ${coordinates.y}]` : ''}`,
  );

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'press_mouse',
        coordinates,
        button,
        press,
      }),
    });
  } catch (error) {
    console.error('Error in press_mouse action:', error);
    throw error;
  }
}

async function dragMouse(input: {
  path: Coordinates[];
  button: Button;
  holdKeys?: string[];
}): Promise<void> {
  const { path, button, holdKeys } = input;
  console.log(
    `Dragging mouse to path: ${path} ${holdKeys ? `with holdKeys: ${holdKeys}` : ''}`,
  );

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'drag_mouse',
        path,
        button,
        holdKeys: holdKeys && holdKeys.length > 0 ? holdKeys : undefined,
      }),
    });
  } catch (error) {
    console.error('Error in drag_mouse action:', error);
    throw error;
  }
}

async function scroll(input: {
  coordinates?: Coordinates;
  direction: 'up' | 'down' | 'left' | 'right';
  scrollCount: number;
  holdKeys?: string[];
}): Promise<void> {
  const { coordinates, direction, scrollCount, holdKeys } = input;
  console.log(
    `Scrolling ${direction} ${scrollCount} times ${coordinates ? `at coordinates: [${coordinates.x}, ${coordinates.y}]` : ''}`,
  );

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'scroll',
        coordinates,
        direction,
        scrollCount,
        holdKeys: holdKeys && holdKeys.length > 0 ? holdKeys : undefined,
      }),
    });
  } catch (error) {
    console.error('Error in scroll action:', error);
    throw error;
  }
}

async function typeKeys(input: {
  keys: string[];
  delay?: number;
}): Promise<void> {
  const { keys, delay } = input;
  console.log(`Typing keys: ${keys}`);

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'type_keys',
        keys,
        delay,
      }),
    });
  } catch (error) {
    console.error('Error in type_keys action:', error);
    throw error;
  }
}

async function pressKeys(input: {
  keys: string[];
  press: Press;
}): Promise<void> {
  const { keys, press } = input;
  console.log(`Pressing keys: ${keys}`);

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'press_keys',
        keys,
        press,
      }),
    });
  } catch (error) {
    console.error('Error in press_keys action:', error);
    throw error;
  }
}

async function typeText(input: {
  text: string;
  delay?: number;
}): Promise<void> {
  const { text, delay } = input;
  console.log(`Typing text: ${text}`);

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'type_text',
        text,
        delay,
      }),
    });
  } catch (error) {
    console.error('Error in type_text action:', error);
    throw error;
  }
}

async function pasteText(input: { text: string }): Promise<void> {
  const { text } = input;
  console.log(`Pasting text: ${text}`);

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'paste_text',
        text,
      }),
    });
  } catch (error) {
    console.error('Error in paste_text action:', error);
    throw error;
  }
}

async function wait(input: { duration: number }): Promise<void> {
  const { duration } = input;
  console.log(`Waiting for ${duration}ms`);

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'wait',
        duration,
      }),
    });
  } catch (error) {
    console.error('Error in wait action:', error);
    throw error;
  }
}

async function cursorPosition(): Promise<Coordinates> {
  console.log('Getting cursor position');

  try {
    const response = await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'cursor_position',
      }),
    });

    const data = await response.json();
    return { x: data.x, y: data.y };
  } catch (error) {
    console.error('Error in cursor_position action:', error);
    throw error;
  }
}

async function screenshot(
  options?: ScreenshotOptions,
): Promise<ScreenshotResponse> {
  console.log('Taking screenshot');

  try {
    const response = await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'screenshot',
        gridOverlay: options?.gridOverlay ?? undefined,
        gridSize: options?.gridSize ?? undefined,
        highlightRegions: options?.highlightRegions ?? undefined,
        showCursor: options?.showCursor ?? true,
        progressStep: options?.progressStep ?? undefined,
        progressMessage: options?.progressMessage ?? undefined,
        progressTaskId: options?.progressTaskId ?? undefined,
        markTarget: options?.markTarget ?? undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to take screenshot: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.image) {
      throw new Error('Failed to take screenshot: No image data received');
    }

    return { image: data.image, offset: data.offset };
  } catch (error) {
    console.error('Error in screenshot action:', error);
    throw error;
  }
}

async function screenInfo(): Promise<{ width: number; height: number }> {
  console.log('Getting screen info');
  try {
    const response = await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'screen_info' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get screen info: ${response.statusText}`);
    }

    const data = await response.json();
    return { width: data.width, height: data.height };
  } catch (error) {
    console.error('Error in screen_info action:', error);
    throw error;
  }
}

async function screenshotRegion(input: {
  region: string;
  gridSize?: number | null;
  enhance?: boolean | null;
  includeOffset?: boolean | null;
  addHighlight?: boolean | null;
  showCursor?: boolean | null;
  progressStep?: number | null;
  progressMessage?: string | null;
  progressTaskId?: string | null;
  zoomLevel?: number | null;
}): Promise<{
  image: string;
  offset?: { x: number; y: number };
  region?: { x: number; y: number; width: number; height: number };
  zoomLevel?: number;
}> {
  console.log(`Taking focused screenshot for region: ${input.region}`);

  try {
    const response = await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'screenshot_region',
        region: input.region,
        gridSize: input.gridSize ?? undefined,
        enhance: input.enhance ?? undefined,
        includeOffset: input.includeOffset ?? undefined,
        addHighlight: input.addHighlight ?? undefined,
        showCursor: input.showCursor ?? true,
        progressStep: input.progressStep ?? undefined,
        progressMessage: input.progressMessage ?? undefined,
        progressTaskId: input.progressTaskId ?? undefined,
        zoomLevel: input.zoomLevel ?? undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to take focused screenshot: ${response.statusText}`,
      );
    }

    const data = await response.json();
    if (!data.image) {
      throw new Error('No image returned for focused screenshot');
    }

    return {
      image: data.image,
      offset: data.offset,
      region: data.region,
      zoomLevel: data.zoomLevel,
    };
  } catch (error) {
    console.error('Error in screenshot_region action:', error);
    throw error;
  }
}

async function screenshotCustomRegion(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  gridSize?: number | null;
  zoomLevel?: number | null;
  markTarget?: { coordinates: Coordinates; label?: string } | null;
  showCursor?: boolean | null;
  progressStep?: number | null;
  progressMessage?: string | null;
  progressTaskId?: string | null;
}): Promise<{
  image: string;
  offset?: { x: number; y: number };
  region?: { x: number; y: number; width: number; height: number };
  zoomLevel?: number;
}> {
  console.log(
    `Taking custom region screenshot at (${input.x}, ${input.y}) ${input.width}x${input.height}`,
  );

  try {
    const response = await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'screenshot_custom_region',
        x: input.x,
        y: input.y,
        width: input.width,
        height: input.height,
        gridSize: input.gridSize ?? undefined,
        zoomLevel: input.zoomLevel ?? undefined,
        markTarget: input.markTarget ?? undefined,
        showCursor: input.showCursor ?? true,
        progressStep: input.progressStep ?? undefined,
        progressMessage: input.progressMessage ?? undefined,
        progressTaskId: input.progressTaskId ?? undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to take custom region screenshot: ${response.statusText}`,
      );
    }

    const data = await response.json();
    if (!data.image) {
      throw new Error('No image returned for custom region screenshot');
    }

    return {
      image: data.image,
      offset: data.offset,
      region: data.region,
      zoomLevel: data.zoomLevel,
    };
  } catch (error) {
    console.error('Error in screenshot_custom_region action:', error);
    throw error;
  }
}

async function application(input: { application: string }): Promise<void> {
  const { application } = input;
  console.log(`Opening application: ${application}`);

  try {
    await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'application',
        application,
      }),
    });
  } catch (error) {
    console.error('Error in application action:', error);
    throw error;
  }
}

async function readFile(input: { path: string }): Promise<{
  success: boolean;
  data?: string;
  name?: string;
  size?: number;
  mediaType?: string;
  message?: string;
}> {
  const { path } = input;
  console.log(`Reading file: ${path}`);

  try {
    const response = await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'read_file',
        path,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to read file: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in read_file action:', error);
    return {
      success: false,
      message: `Error reading file: ${error.message}`,
    };
  }
}

export async function writeFile(input: {
  path: string;
  content: string;
}): Promise<{ success: boolean; message?: string }> {
  const { path, content } = input;
  console.log(`Writing file: ${path}`);

  try {
    // Content is always base64 encoded
    const base64Data = content;

    const response = await fetch(`${BYTEBOT_DESKTOP_BASE_URL}/computer-use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'write_file',
        path,
        data: base64Data,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to write file: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in write_file action:', error);
    return {
      success: false,
      message: `Error writing file: ${error.message}`,
    };
  }
}
