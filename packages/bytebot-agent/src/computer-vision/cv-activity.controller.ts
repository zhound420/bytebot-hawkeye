import { Controller, Get } from '@nestjs/common';
import { CVActivityIndicatorService } from '@bytebot/cv/services/cv-activity-indicator.service';

@Controller('cv-activity')
export class CVActivityController {
  constructor(
    private readonly cvActivityService: CVActivityIndicatorService
  ) {}

  /**
   * Get current CV activity snapshot
   */
  @Get('status')
  getActivityStatus() {
    return this.cvActivityService.getSnapshot();
  }

  /**
   * Get CV method performance statistics
   */
  @Get('performance')
  getPerformanceStats() {
    return this.cvActivityService.getMethodPerformance();
  }

  /**
   * Get CV method execution history
   */
  @Get('history')
  getMethodHistory() {
    return {
      history: this.cvActivityService.getMethodHistory().slice(-20), // Last 20 executions
      totalExecutions: this.cvActivityService.getMethodHistory().length
    };
  }

  /**
   * Simple polling endpoint for CV activity updates (replaces SSE for compatibility)
   */
  @Get('stream')
  streamActivity() {
    return {
      timestamp: Date.now(),
      ...this.cvActivityService.getSnapshot()
    };
  }

  /**
   * Check if any CV methods are currently active
   */
  @Get('active')
  isActive() {
    return {
      active: this.cvActivityService.hasActiveMethods(),
      activeCount: this.cvActivityService.getSnapshot().totalActiveCount,
      activeMethods: this.cvActivityService.getSnapshot().activeMethods
    };
  }
}