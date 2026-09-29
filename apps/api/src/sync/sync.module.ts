import { Module } from '@nestjs/common';
import { FixtureSyncService } from './fixture-sync.service';

@Module({
  providers: [FixtureSyncService],
  exports: [FixtureSyncService],
})
export class SyncModule {}
