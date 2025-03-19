import { Module } from '@nestjs/common';
import { MCPService } from './mcp.service';
import { MCPGateway } from './mcp.gateway';
import { ComputerUseModule } from '../computer-use/computer-use.module';

@Module({
  imports: [ComputerUseModule],
  providers: [MCPService, MCPGateway],
  exports: [MCPService],
})
export class MCPModule {}
