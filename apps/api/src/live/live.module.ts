import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LIVE_BUS, createLiveBus, type LiveBus } from './live-bus';
import { LivePollerService } from './live-poller.service';

@Global()
@Module({
  providers: [
    {
      provide: LIVE_BUS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createLiveBus(config.get<string>('REDIS_URL')),
    },
    LivePollerService,
  ],
  exports: [LIVE_BUS, LivePollerService],
})
export class LiveModule implements OnApplicationShutdown {
  constructor(@Inject(LIVE_BUS) private readonly bus: LiveBus) {}

  async onApplicationShutdown() {
    await this.bus.close();
  }
}
