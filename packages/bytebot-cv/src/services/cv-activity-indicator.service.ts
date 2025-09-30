import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';

export interface CVMethodActivity {
  method: string;
  active: boolean;
  startTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface CVActivitySnapshot {
  activeMethods: string[];
  totalActiveCount: number;
  methodDetails: Record<string, CVMethodActivity>;
  performance: {
    averageProcessingTime: number;
    totalMethodsExecuted: number;
    successRate: number;
  };
}

@Injectable()
export class CVActivityIndicatorService extends EventEmitter {
  private readonly logger = new Logger(CVActivityIndicatorService.name);
  private activeMethods = new Map<string, CVMethodActivity>();
  private methodHistory: CVMethodActivity[] = [];
  private readonly maxHistorySize = 100;

  constructor() {
    super();
    this.logger.log('CV Activity Indicator Service initialized');
  }

  /**
   * Start tracking a CV method execution
   */
  startMethod(methodName: string, metadata?: Record<string, any>): string {
    const activityId = `${methodName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const activity: CVMethodActivity = {
      method: methodName,
      active: true,
      startTime: Date.now(),
      metadata: metadata || {}
    };

    this.activeMethods.set(activityId, activity);

    // Emit activity update
    this.emit('methodStarted', {
      id: activityId,
      method: methodName,
      metadata
    });

    this.emit('activityUpdate', this.getSnapshot());

    this.logger.debug(`Started CV method: ${methodName} (${activityId})`);
    return activityId;
  }

  /**
   * Stop tracking a CV method execution
   */
  stopMethod(activityId: string, success: boolean = true, result?: any): void {
    const activity = this.activeMethods.get(activityId);
    if (!activity) {
      this.logger.warn(`Attempted to stop unknown CV method activity: ${activityId}`);
      return;
    }

    const endTime = Date.now();
    const duration = activity.startTime ? endTime - activity.startTime : 0;

    // Update activity
    activity.active = false;
    activity.duration = duration;
    activity.metadata = {
      ...activity.metadata,
      success,
      result,
      endTime
    };

    // Move to history
    this.addToHistory(activity);
    this.activeMethods.delete(activityId);

    // Emit activity update
    this.emit('methodCompleted', {
      id: activityId,
      method: activity.method,
      duration,
      success,
      result
    });

    this.emit('activityUpdate', this.getSnapshot());

    this.logger.debug(`Completed CV method: ${activity.method} in ${duration}ms (success: ${success})`);
  }

  /**
   * Update metadata for an active method
   */
  updateMethodMetadata(activityId: string, metadata: Record<string, any>): void {
    const activity = this.activeMethods.get(activityId);
    if (activity) {
      activity.metadata = { ...activity.metadata, ...metadata };
      this.emit('activityUpdate', this.getSnapshot());
    }
  }

  /**
   * Get current activity snapshot for UI display
   */
  getSnapshot(): CVActivitySnapshot {
    const activeMethodsArray = Array.from(this.activeMethods.values());
    const activeMethods = activeMethodsArray.map(a => a.method);

    // Calculate performance metrics
    const recentHistory = this.methodHistory.slice(-50);
    const totalExecuted = recentHistory.length;
    const successfulExecutions = recentHistory.filter(h => h.metadata?.success === true).length;
    const successRate = totalExecuted > 0 ? successfulExecutions / totalExecuted : 1;

    const averageProcessingTime = recentHistory.length > 0
      ? recentHistory.reduce((sum, h) => sum + (h.duration || 0), 0) / recentHistory.length
      : 0;

    const methodDetails: Record<string, CVMethodActivity> = {};
    this.activeMethods.forEach((activity, id) => {
      methodDetails[id] = activity;
    });

    return {
      activeMethods,
      totalActiveCount: activeMethods.length,
      methodDetails,
      performance: {
        averageProcessingTime,
        totalMethodsExecuted: this.methodHistory.length,
        successRate
      }
    };
  }

  /**
   * Get method execution history for debugging
   */
  getMethodHistory(): CVMethodActivity[] {
    return [...this.methodHistory];
  }

  /**
   * Get performance statistics for specific methods
   */
  getMethodPerformance(methodName?: string): {
    method: string;
    executionCount: number;
    averageTime: number;
    successRate: number;
    lastExecuted?: number;
  }[] {
    const methodStats = new Map<string, {
      executions: CVMethodActivity[];
      lastExecuted: number;
    }>();

    // Group history by method
    this.methodHistory.forEach(activity => {
      if (methodName && activity.method !== methodName) return;

      if (!methodStats.has(activity.method)) {
        methodStats.set(activity.method, {
          executions: [],
          lastExecuted: 0
        });
      }

      const stats = methodStats.get(activity.method)!;
      stats.executions.push(activity);
      stats.lastExecuted = Math.max(stats.lastExecuted, activity.startTime || 0);
    });

    // Calculate statistics
    return Array.from(methodStats.entries()).map(([method, stats]) => {
      const executions = stats.executions;
      const executionCount = executions.length;
      const averageTime = executions.reduce((sum, e) => sum + (e.duration || 0), 0) / executionCount;
      const successfulExecutions = executions.filter(e => e.metadata?.success === true).length;
      const successRate = successfulExecutions / executionCount;

      return {
        method,
        executionCount,
        averageTime,
        successRate,
        lastExecuted: stats.lastExecuted > 0 ? stats.lastExecuted : undefined
      };
    });
  }

  /**
   * Check if any CV methods are currently active
   */
  hasActiveMethods(): boolean {
    return this.activeMethods.size > 0;
  }

  /**
   * Check if a specific method is currently active
   */
  isMethodActive(methodName: string): boolean {
    return Array.from(this.activeMethods.values()).some(a => a.method === methodName);
  }

  /**
   * Clear method history (useful for debugging/testing)
   */
  clearHistory(): void {
    this.methodHistory = [];
    this.logger.debug('CV method history cleared');
  }

  /**
   * Force stop all active methods (cleanup)
   */
  stopAllActiveMethods(): void {
    const activeIds = Array.from(this.activeMethods.keys());
    activeIds.forEach(id => this.stopMethod(id, false));
    this.logger.debug(`Stopped ${activeIds.length} active CV methods`);
  }

  private addToHistory(activity: CVMethodActivity): void {
    this.methodHistory.push({ ...activity });

    // Trim history if it gets too large
    if (this.methodHistory.length > this.maxHistorySize) {
      this.methodHistory = this.methodHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Helper method to wrap CV method execution with automatic tracking
   */
  async executeWithTracking<T>(
    methodName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const activityId = this.startMethod(methodName, metadata);

    try {
      const result = await operation();
      this.stopMethod(activityId, true, result);
      return result;
    } catch (error) {
      this.stopMethod(activityId, false, { error: error.message });
      throw error;
    }
  }

  /**
   * Synchronous version of executeWithTracking
   */
  executeWithTrackingSync<T>(
    methodName: string,
    operation: () => T,
    metadata?: Record<string, any>
  ): T {
    const activityId = this.startMethod(methodName, metadata);

    try {
      const result = operation();
      this.stopMethod(activityId, true, result);
      return result;
    } catch (error) {
      this.stopMethod(activityId, false, { error: error.message });
      throw error;
    }
  }
}