import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createProxyMiddleware } from 'http-proxy-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const wsProxy = createProxyMiddleware({
    target: 'http://localhost:6080',
    ws: true,
    changeOrigin: true,
    pathRewrite: { '^/websockify': '/' },
  });
  app.use('/websockify', wsProxy);
  const server = await app.listen(9990);
  server.on('upgrade', wsProxy.upgrade);
}
bootstrap();
