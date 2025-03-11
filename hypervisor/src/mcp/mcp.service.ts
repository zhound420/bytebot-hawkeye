import { Injectable, Logger } from '@nestjs/common';
import { ComputerUseService } from '../computer-use/computer-use.service';
import { 
  MCPServer, 
  createTool 
} from '@modelcontextprotocol/sdk';
import { 
  KeyInputSchema, 
  TypeInputSchema, 
  MouseMoveInputSchema, 
  LeftClickInputSchema, 
  RightClickInputSchema, 
  MiddleClickInputSchema, 
  DoubleClickInputSchema, 
  LeftClickDragInputSchema, 
  ScrollInputSchema, 
  ScreenshotInputSchema, 
  CursorPositionInputSchema,
  ScreenshotOutputSchema,
  CursorPositionOutputSchema
} from './mcp.types';
import * as http from 'http';

@Injectable()
export class MCPService {
  private readonly logger = new Logger(MCPService.name);
  private mcpServer: MCPServer;
  private readonly MCP_PATH = '/mcp';
  
  constructor(private readonly computerUseService: ComputerUseService) {
    this.initializeMCPServer();
  }
  
  private initializeMCPServer() {
    this.mcpServer = new MCPServer({
      name: 'computer-use',
      description: 'Control the virtual machine through keyboard, mouse, and screen interactions',
    });
    
    this.registerTools();
    this.registerResources();
  }
  
  private registerTools() {
    // Register all computer-use tools with proper input validation
    this.mcpServer.addTool(
      createTool({
        name: 'key',
        description: 'Sends a single key event',
        inputSchema: KeyInputSchema,
        handler: async (input) => {
          this.logger.log(`Sending key: ${input.key}`);
          return await this.computerUseService.key(input.key);
        },
      })
    );
    
    this.mcpServer.addTool(
      createTool({
        name: 'type',
        description: 'Types the specified text with an optional delay between keystrokes',
        inputSchema: TypeInputSchema,
        handler: async (input) => {
          this.logger.log(`Typing text: ${input.text}`);
          await this.computerUseService.type(input.text, input.delayMs);
          return { success: true };
        },
      })
    );
    
    this.mcpServer.addTool(
      createTool({
        name: 'mouse_move',
        description: 'Moves the mouse cursor to the specified coordinates',
        inputSchema: MouseMoveInputSchema,
        handler: async (input) => {
          this.logger.log(`Moving mouse to: (${input.x}, ${input.y})`);
          return await this.computerUseService.mouse_move(input.x, input.y);
        },
      })
    );
    
    this.mcpServer.addTool(
      createTool({
        name: 'left_click',
        description: 'Performs a left mouse click at the current cursor position',
        inputSchema: LeftClickInputSchema,
        handler: async () => {
          this.logger.log('Performing left click');
          await this.computerUseService.left_click();
          return { success: true };
        },
      })
    );
    
    this.mcpServer.addTool(
      createTool({
        name: 'right_click',
        description: 'Performs a right mouse click at the current cursor position',
        inputSchema: RightClickInputSchema,
        handler: async () => {
          this.logger.log('Performing right click');
          await this.computerUseService.right_click();
          return { success: true };
        },
      })
    );
    
    this.mcpServer.addTool(
      createTool({
        name: 'middle_click',
        description: 'Performs a middle mouse click at the current cursor position',
        inputSchema: MiddleClickInputSchema,
        handler: async () => {
          this.logger.log('Performing middle click');
          await this.computerUseService.middle_click();
          return { success: true };
        },
      })
    );
    
    this.mcpServer.addTool(
      createTool({
        name: 'double_click',
        description: 'Performs a double-click with optional delay between clicks',
        inputSchema: DoubleClickInputSchema,
        handler: async (input) => {
          this.logger.log('Performing double click');
          await this.computerUseService.double_click(input.delayMs);
          return { success: true };
        },
      })
    );
    
    this.mcpServer.addTool(
      createTool({
        name: 'left_click_drag',
        description: 'Performs a drag operation from start to end coordinates',
        inputSchema: LeftClickDragInputSchema,
        handler: async (input) => {
          this.logger.log(`Performing left click drag from (${input.startX}, ${input.startY}) to (${input.endX}, ${input.endY})`);
          await this.computerUseService.left_click_drag(
            input.startX,
            input.startY,
            input.endX,
            input.endY,
            input.holdMs
          );
          return { success: true };
        },
      })
    );
    
    this.mcpServer.addTool(
      createTool({
        name: 'scroll',
        description: 'Scrolls vertically or horizontally by the specified amount',
        inputSchema: ScrollInputSchema,
        handler: async (input) => {
          this.logger.log(`Scrolling ${input.axis === 'v' ? 'vertically' : 'horizontally'} by ${input.amount}`);
          await this.computerUseService.scroll(input.amount, input.axis);
          return { success: true };
        },
      })
    );
  }
  
  private registerResources() {
    // Register resources (data that can be accessed)
    this.mcpServer.addResource({
      uri: 'screenshot://current',
      schema: ScreenshotOutputSchema,
      handler: async () => {
        this.logger.log('Taking screenshot');
        return await this.computerUseService.screenshot();
      }
    });
    
    this.mcpServer.addResource({
      uri: 'cursor://position',
      schema: CursorPositionOutputSchema,
      handler: async () => {
        this.logger.log('Getting cursor position');
        return await this.computerUseService.cursor_position();
      }
    });
  }
  
  async attachToHttpServer(httpServer: http.Server) {
    try {
      // Attach MCP server to existing HTTP server with a specific path
      await this.mcpServer.attachToHttpServer(httpServer, {
        path: this.MCP_PATH
      });
      this.logger.log(`MCP server attached to HTTP server at path ${this.MCP_PATH}`);
    } catch (error) {
      this.logger.error(`Failed to attach MCP server: ${error.message}`, error.stack);
      throw error;
    }
  }
  
  async stop() {
    try {
      await this.mcpServer.close();
      this.logger.log('MCP server stopped');
    } catch (error) {
      this.logger.error(`Error stopping MCP server: ${error.message}`, error.stack);
    }
  }
  
  getMcpPath(): string {
    return this.MCP_PATH;
  }
}
