import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CRICKET_PROVIDER, type CricketDataProvider } from './cricket-provider.interface';
import { MockCricketProvider } from './mock/mock-cricket.provider';

/**
 * Picks the data provider from CRICKET_PROVIDER (default "mock").
 * To add a real provider: implement CricketDataProvider, then add a case here.
 */
export function createProvider(name: string | undefined): CricketDataProvider {
  switch ((name ?? 'mock').toLowerCase()) {
    case 'mock':
      return new MockCricketProvider();
    default:
      throw new Error(`Unknown CRICKET_PROVIDER "${name}". Supported: mock`);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: CRICKET_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => createProvider(config.get<string>('CRICKET_PROVIDER')),
    },
  ],
  exports: [CRICKET_PROVIDER],
})
export class ProviderModule {}
