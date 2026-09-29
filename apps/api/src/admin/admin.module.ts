import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminKeyGuard } from './admin-key.guard';
import { AdminService } from './admin.service';
import { RightsCheckerService } from './rights-checker.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminKeyGuard, RightsCheckerService],
})
export class AdminModule {}
