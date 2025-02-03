import { Module } from '@nestjs/common';
import { ComputerUseService } from './computer-use.service';
import { ComputerUseController } from './computer-use.controller';
import { QemuModule } from '../qemu/qemu.module';

@Module({
  imports: [QemuModule],
  controllers: [ComputerUseController],
  providers: [ComputerUseService],
  exports: [ComputerUseService],
})
export class ComputerUseModule {}
