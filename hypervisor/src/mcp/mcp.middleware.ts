import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { MCPService } from './mcp.service';

@Injectable()
export class MCPMiddleware implements NestMiddleware {
  private readonly logger = new Logger(MCPMiddleware.name);
  private transports = new Map<string, SSEServerTransport>();

  constructor(private readonly mcpService: MCPService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const path = this.mcpService.getMcpPath();
    const messagesPath = `${path}/messages`;

    // Handle SSE connection requests to /mcp
    if (req.path === path && req.method === 'GET') {
      this.logger.log(`Setting up SSE endpoint at ${path}`);

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // Generate a unique connection ID
      const connectionId = Date.now().toString();

      // Create SSE transport
      const transport = new SSEServerTransport(messagesPath, res);
      this.transports.set(connectionId, transport);

      // Connect to MCP server
      this.mcpService.connectTransport(transport).catch((error) => {
        this.logger.error(
          `Failed to connect transport: ${error.message}`,
          error.stack,
        );
      });

      // Clean up when connection closes
      res.on('close', () => {
        this.logger.log(`SSE connection ${connectionId} closed`);
        this.transports.delete(connectionId);
      });

      return; // Don't call next() for SSE connections
    }

    // Handle message POST requests to /mcp/messages
    if (req.path === messagesPath && req.method === 'POST') {
      if (this.transports.size === 0) {
        return res.status(503).json({ error: 'No active MCP connections' });
      }

      // For simplicity, use the most recent transport
      // In a production system, you might want to use a session/connection ID
      const transport = Array.from(this.transports.values())[
        this.transports.size - 1
      ];

      transport.handlePostMessage(req, res).catch((error) => {
        this.logger.error(
          `Failed to handle post message: ${error.message}`,
          error.stack,
        );
        res.status(500).json({ error: 'Failed to process MCP message' });
      });

      return; // Don't call next() for message handling
    }

    // For all other requests, continue with the middleware chain
    next();
  }
}
