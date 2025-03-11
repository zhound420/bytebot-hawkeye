import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { MCPService } from './mcp.service';
import { HttpAdapterHost } from '@nestjs/core';

@Injectable()
export class MCPGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MCPGateway.name);

  constructor(
    private readonly mcpService: MCPService,
    private readonly httpAdapterHost: HttpAdapterHost
  ) {}

  async onModuleInit() {
    try {
      // Get the underlying HTTP server from NestJS
      const httpServer = this.httpAdapterHost.httpAdapter.getHttpServer();
      
      // Attach the MCP server to the existing HTTP server
      await this.mcpService.attachToHttpServer(httpServer);
      
      const mcpPath = this.mcpService.getMcpPath();
      this.logger.log(`MCP Gateway initialized at path ${mcpPath}`);
    } catch (error) {
      this.logger.error(`Failed to initialize MCP Gateway: ${error.message}`, error.stack);
    }
  }

  async onModuleDestroy() {
    try {
      await this.mcpService.stop();
      this.logger.log('MCP Gateway shutdown');
    } catch (error) {
      this.logger.error(`Error during MCP Gateway shutdown: ${error.message}`, error.stack);
    }
  }
}
