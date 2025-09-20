import { Module } from '@nestjs/common';
import { ComputerUseService } from './computer-use.service';
import { ComputerUseController } from './computer-use.controller';
import { NutModule } from '../nut/nut.module';
import { GridOverlayService } from '../nut/grid-overlay.service';
import { FocusRegionService } from '../nut/focus-region.service';
import { ProgressBroadcaster } from '../progress/progress-broadcaster';
import { ZoomScreenshotService } from '../nut/zoom-screenshot.service';
import { TelemetryService } from '../telemetry/telemetry.service';
import { TelemetryController } from '../telemetry/telemetry.controller';

@Module({
  imports: [NutModule],
  controllers: [ComputerUseController, TelemetryController],
  providers: [
    ComputerUseService,
    GridOverlayService,
    FocusRegionService,
    ZoomScreenshotService,
    ProgressBroadcaster,
    TelemetryService,
  ],
  exports: [ComputerUseService],
})
export class ComputerUseModule {}
