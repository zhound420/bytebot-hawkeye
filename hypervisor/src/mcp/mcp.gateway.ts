import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { MCPService } from './mcp.service';

@Injectable()
export class MCPGateway implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MCPGateway.name);

  constructor(
    private readonly mcpService: MCPService
  ) {}

  async onModuleInit() {
    try {
      const mcpPath = this.mcpService.getMcpPath();
      this.logger.log(`MCP Gateway initialized at path ${mcpPath}`);
      this.logger.log('MCP is now available via NestJS middleware');
    } catch (error) {
      this.logger.error(`Failed to initialize MCP Gateway: ${error.message}`, error.stack);
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('MCP Gateway shutdown');
    } catch (error) {
      this.logger.error(`Error during MCP Gateway shutdown: ${error.message}`, error.stack);
    }
  }
}
