import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { MCPService } from './mcp.service';
import { MCPGateway } from './mcp.gateway';
import { ComputerUseModule } from '../computer-use/computer-use.module';
import { MCPMiddleware } from './mcp.middleware';

@Module({
  imports: [ComputerUseModule],
  providers: [MCPService, MCPGateway],
  exports: [MCPService],
})
export class MCPModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(MCPMiddleware)
      .forRoutes(
        { path: '/mcp', method: RequestMethod.GET },
        { path: '/mcp/messages', method: RequestMethod.POST }
      );
  }
}
