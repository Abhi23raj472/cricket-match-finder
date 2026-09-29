import { Controller, Get } from '@nestjs/common';
import { DEFAULT_REGION, DEFAULT_TIMEZONE } from '@cmf/shared';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'cricket-match-finder-api',
      defaultRegion: DEFAULT_REGION,
      defaultTimezone: DEFAULT_TIMEZONE,
    };
  }
}
