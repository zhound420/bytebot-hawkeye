import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  console.log('Starting bytebot-agent application...');

  try {
    const app = await NestFactory.create(AppModule);

    // Enable CORS
    app.enableCors({
      origin: process.env.CLIENT_BASE_URL,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      credentials: true,
    });

    await app.listen(process.env.PORT ?? 9991);
  } catch (error) {
    console.error('Error starting application:', error);
  }
}
bootstrap();
