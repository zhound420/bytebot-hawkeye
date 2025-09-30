import { z } from 'zod';

const regionSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  })
  .describe('Optional region to search within');

export const computerDetectElementsSchema = z.object({
  description: z
    .string()
    .min(1)
    .describe(
      'Description of the UI element to find (e.g., "Install button", "username field", "Save link")',
    ),
  region: regionSchema.optional(),
  includeAll: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'Return all detected elements, not just those matching description',
    ),
});

export type ComputerDetectElementsInput = z.infer<
  typeof computerDetectElementsSchema
>;

const regionJsonSchema = {
  type: 'object' as const,
  properties: {
    x: { type: 'number' as const },
    y: { type: 'number' as const },
    width: { type: 'number' as const },
    height: { type: 'number' as const },
  },
  required: ['x', 'y', 'width', 'height'],
};

const coordinateJsonSchema = {
  type: 'object' as const,
  properties: {
    x: { type: 'number' as const },
    y: { type: 'number' as const },
  },
  required: ['x', 'y'],
};

const computerDetectElementsJsonSchema = {
  type: 'object' as const,
  properties: {
    description: {
      type: 'string' as const,
      description:
        'Description of the UI element to find (e.g., "Install button", "username field", "Save link")',
    },
    region: {
      ...regionJsonSchema,
      description: 'Optional region to search within',
    },
    includeAll: {
      type: 'boolean' as const,
      default: false,
      description:
        'Return all detected elements, not just those matching description',
    },
  },
  required: ['description'],
  additionalProperties: false,
};

export const computerDetectElementsTool = {
  name: 'computer_detect_elements',
  description:
    'Detect UI elements in the current screenshot using computer vision techniques including OCR, template matching, and edge detection. This is the preferred method for finding clickable elements instead of manual coordinate targeting.',
  input_schema: computerDetectElementsJsonSchema,
};

export const computerClickElementSchema = z.object({
  element_id: z
    .string()
    .min(1)
    .describe('ID of the element from detect_elements response'),
  fallback_coordinates: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional()
    .describe('Backup coordinates to try if element targeting fails'),
});

export type ComputerClickElementInput = z.infer<
  typeof computerClickElementSchema
>;

const computerClickElementJsonSchema = {
  type: 'object' as const,
  properties: {
    element_id: {
      type: 'string' as const,
      description: 'ID of the element from detect_elements response',
    },
    fallback_coordinates: {
      ...coordinateJsonSchema,
      description: 'Backup coordinates to try if element targeting fails',
    },
  },
  required: ['element_id'],
  additionalProperties: false,
};

export const computerClickElementTool = {
  name: 'computer_click_element',
  description:
    'Click a UI element that was detected by computer_detect_elements. This is more reliable than manual coordinate clicking as it uses the actual detected element boundaries.',
  input_schema: computerClickElementJsonSchema,
};
