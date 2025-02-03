import { Module } from '@nestjs/common';
import { ComputerUseModule } from './computer-use/computer-use.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [ComputerUseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
