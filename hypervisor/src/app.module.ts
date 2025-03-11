import { Module } from '@nestjs/common';
import { ComputerUseModule } from './computer-use/computer-use.module';
import { MCPModule } from './mcp/mcp.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ComputerUseModule, MCPModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
