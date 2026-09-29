import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import type { RightsGapDto } from '@cmf/shared';
import { AdminService } from './admin.service';

/**
 * Daily at 09:00 IST: logs every match in the next 14 days that has no way
 * to watch in a region, so admins can add rights before the match starts.
 * The same list is available any time at GET /admin/rights/gaps and on the
 * admin panel's "Gaps" tab.
 */
@Injectable()
export class RightsCheckerService {
  private readonly logger = new Logger(RightsCheckerService.name);

  constructor(
    private readonly admin: AdminService,
    private readonly config: ConfigService,
  ) {}

  @Cron('0 9 * * *', { name: 'rights-checker', timeZone: 'Asia/Kolkata' })
  async scheduledCheck() {
    if (this.config.get('JOBS_ENABLED', 'true') === 'false') return;
    try {
      await this.check();
    } catch (err) {
      this.logger.error(`Rights check failed: ${(err as Error).message}`);
    }
  }

  async check(days = 14): Promise<RightsGapDto[]> {
    const gaps = await this.admin.rightsGaps(days);
    if (gaps.length === 0) {
      this.logger.log(`Rights check: every match in the next ${days} days has a broadcaster`);
    } else {
      this.logger.warn(`Rights check: ${gaps.length} match/region gap(s) in the next ${days} days`);
      for (const g of gaps) {
        this.logger.warn(`  ${g.regionCode}  ${g.match.startTimeUtc}  ${g.match.tournamentName}: ${g.match.label}`);
      }
    }
    return gaps;
  }
}
