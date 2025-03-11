import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  
  // Enable CORS for both REST and WebSocket connections
  app.enableCors();
  
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Hypervisor server running on port ${port}`);
  logger.log(`REST API available at http://localhost:${port}/computer-use`);
  logger.log(`MCP server available at mcp://localhost:${port}/mcp`);
}
bootstrap();
