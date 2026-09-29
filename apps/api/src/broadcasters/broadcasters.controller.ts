import { Controller, Get, Injectable, Module } from '@nestjs/common';
import type { BroadcasterDto } from '@cmf/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BroadcastersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Active broadcasters, for the "My subscriptions" picker. */
  async list(): Promise<BroadcasterDto[]> {
    const rows = await this.prisma.broadcaster.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, type: true, logoUrl: true },
    });
    return rows as BroadcasterDto[];
  }
}

@Controller('broadcasters')
export class BroadcastersController {
  constructor(private readonly broadcasters: BroadcastersService) {}

  @Get()
  list(): Promise<BroadcasterDto[]> {
    return this.broadcasters.list();
  }
}

@Module({ controllers: [BroadcastersController], providers: [BroadcastersService] })
export class BroadcastersModule {}
