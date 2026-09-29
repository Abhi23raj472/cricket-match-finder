import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { ProviderModule } from './provider/provider.module';
import { LiveModule } from './live/live.module';
import { SyncModule } from './sync/sync.module';
import { MatchesModule } from './matches/matches.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { BroadcastersModule } from './broadcasters/broadcasters.controller';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../../.env', '.env'] }),
    ScheduleModule.forRoot(),
    PrismaModule,
    ProviderModule,
    LiveModule,
    SyncModule,
    MatchesModule,
    TournamentsModule,
    BroadcastersModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
