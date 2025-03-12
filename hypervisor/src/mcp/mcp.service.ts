import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ComputerUseService } from '../computer-use/computer-use.service';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import * as z from 'zod';

@Injectable()
export class MCPService implements OnModuleDestroy {
  private readonly logger = new Logger(MCPService.name);
  private mcpServer: McpServer;
  private readonly MCP_PATH = '/mcp';

  constructor(private readonly computerUseService: ComputerUseService) {
    this.initializeMCPServer();
  }

  getMcpPath(): string {
    return this.MCP_PATH;
  }

  private initializeMCPServer() {
    this.mcpServer = new McpServer({
      name: 'computer-use',
      version: '1.0.0',
      description:
        'Control the virtual machine through keyboard, mouse, and screen interactions',
    });

    this.registerTools();
    this.registerResources();
  }

  private registerTools() {
    // Register all computer-use tools with proper input validation
    this.mcpServer.tool(
      'key',
      {
        key: z
          .string()
          .describe('A string representing the key (e.g. "enter", "a", etc.)'),
      },
      async ({ key }) => {
        this.logger.log(`Sending key: ${key}`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await this.computerUseService.key(key)),
            },
          ],
        };
      },
    );

    this.mcpServer.tool(
      'type',
      {
        text: z.string().describe('The text to type'),
        delayMs: z
          .number()
          .optional()
          .default(100)
          .describe('Optional delay in milliseconds between keystrokes'),
      },
      async ({ text, delayMs }) => {
        this.logger.log(`Typing text: ${text}`);
        await this.computerUseService.type(text, delayMs);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      },
    );

    this.mcpServer.tool(
      'mouse_move',
      {
        x: z.number().describe('The absolute x-coordinate'),
        y: z.number().describe('The absolute y-coordinate'),
      },
      async ({ x, y }) => {
        this.logger.log(`Moving mouse to: (${x}, ${y})`);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await this.computerUseService.mouse_move(x, y),
              ),
            },
          ],
        };
      },
    );

    this.mcpServer.tool('left_click', {}, async () => {
      this.logger.log('Performing left click');
      await this.computerUseService.left_click();
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
      };
    });

    this.mcpServer.tool('right_click', {}, async () => {
      this.logger.log('Performing right click');
      await this.computerUseService.right_click();
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
      };
    });

    this.mcpServer.tool('middle_click', {}, async () => {
      this.logger.log('Performing middle click');
      await this.computerUseService.middle_click();
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
      };
    });

    this.mcpServer.tool(
      'double_click',
      {
        delayMs: z
          .number()
          .optional()
          .default(100)
          .describe('Optional delay between clicks'),
      },
      async ({ delayMs }) => {
        this.logger.log('Performing double click');
        await this.computerUseService.double_click(delayMs);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      },
    );

    this.mcpServer.tool(
      'left_click_drag',
      {
        startX: z.number().describe('Starting x-coordinate'),
        startY: z.number().describe('Starting y-coordinate'),
        endX: z.number().describe('Ending x-coordinate'),
        endY: z.number().describe('Ending y-coordinate'),
        holdMs: z
          .number()
          .optional()
          .default(100)
          .describe('Optional delay (in ms) to hold the click before dragging'),
      },
      async ({ startX, startY, endX, endY, holdMs }) => {
        this.logger.log(
          `Performing left click drag from (${startX}, ${startY}) to (${endX}, ${endY})`,
        );
        await this.computerUseService.left_click_drag(
          startX,
          startY,
          endX,
          endY,
          holdMs,
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      },
    );

    this.mcpServer.tool(
      'scroll',
      {
        amount: z
          .number()
          .describe(
            'The amount to scroll. Positive values scroll up, negative values scroll down',
          ),
        axis: z
          .enum(['v', 'h'])
          .optional()
          .default('v')
          .describe(
            'Optional axis to scroll on. "v" for vertical, "h" for horizontal',
          ),
      },
      async ({ amount, axis }) => {
        this.logger.log(
          `Scrolling ${axis === 'v' ? 'vertically' : 'horizontally'} by ${amount}`,
        );
        await this.computerUseService.scroll(amount, axis);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
        };
      },
    );
  }

  private registerResources() {
    // Register resources (data that can be accessed)
    this.mcpServer.resource('screenshot', 'screenshot://current', async () => {
      this.logger.log('Taking screenshot');
      const screenshotData = await this.computerUseService.screenshot();
      return {
        contents: [
          {
            uri: 'screenshot://current',
            text: JSON.stringify(screenshotData),
          },
        ],
      };
    });

    this.mcpServer.resource(
      'cursor_position',
      'cursor://position',
      async () => {
        this.logger.log('Getting cursor position');
        const position = await this.computerUseService.cursor_position();
        return {
          contents: [
            {
              uri: 'cursor://position',
              text: JSON.stringify(position),
            },
          ],
        };
      },
    );
  }

  /**
   * Connect a transport to the MCP server
   * This is used by the middleware to establish connections
   */
  async connectTransport(transport: SSEServerTransport): Promise<void> {
    try {
      this.logger.log('Connecting transport to MCP server');
      await this.mcpServer.connect(transport);
      this.logger.log('Transport connected successfully');
    } catch (error) {
      this.logger.error(
        `Failed to connect transport: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  onModuleDestroy() {
    this.logger.log('MCP module is being destroyed - cleaning up');
  }
}
