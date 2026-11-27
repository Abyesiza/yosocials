import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { EnvironmentVariables } from '../../config/env.validation.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { PublishingService } from './publishing.service.js';

/**
 * Background jobs. Each skips a tick if its previous run is still going, so
 * a slow platform can't pile up overlapping runs.
 */
@Injectable()
export class PublishingScheduler {
  private readonly logger = new Logger(PublishingScheduler.name);
  private readonly enabled: boolean;
  private readonly running = new Set<string>();

  constructor(
    config: ConfigService<EnvironmentVariables, true>,
    private readonly publishing: PublishingService,
    private readonly analytics: AnalyticsService,
  ) {
    this.enabled = config.get('SCHEDULER_ENABLED', { infer: true });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  publishDue(): Promise<void> {
    return this.once('publish', async () => {
      await this.publishing.failStuck();
      const outcomes = await this.publishing.publishDue();
      if (outcomes.length > 0) {
        this.logger.log(`Processed ${outcomes.length} scheduled target(s)`);
      }
    });
  }

  @Cron('30 * * * * *')
  syncProcessing(): Promise<void> {
    return this.once('sync', async () => {
      await this.publishing.syncProcessing();
    });
  }

  @Cron('0 */15 * * * *')
  collectMetrics(): Promise<void> {
    return this.once('metrics', async () => {
      const count = await this.analytics.collectDue();
      if (count > 0) this.logger.log(`Captured metrics for ${count} target(s)`);
    });
  }

  private async once(job: string, run: () => Promise<void>): Promise<void> {
    if (!this.enabled || this.running.has(job)) return;
    this.running.add(job);
    try {
      await run();
    } catch (error) {
      this.logger.error(
        `Job "${job}" failed`,
        error instanceof Error ? error.stack : error,
      );
    } finally {
      this.running.delete(job);
    }
  }
}
