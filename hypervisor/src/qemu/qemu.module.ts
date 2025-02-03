import { Module } from '@nestjs/common';
import { QemuService } from './qemu.service';
import { QmpClientService } from './qmp-client.service';

@Module({
  providers: [QemuService, QmpClientService],
  exports: [QemuService],
})
export class QemuModule {}
