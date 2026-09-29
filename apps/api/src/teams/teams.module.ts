import { Controller, Get, Injectable, Module } from '@nestjs/common';
import type { TeamDto } from '@cmf/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  /** All teams A–Z, for choosing favourite teams. */
  async list(): Promise<TeamDto[]> {
    return this.prisma.team.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, shortCode: true, country: true, logoUrl: true },
    });
  }
}

@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(): Promise<TeamDto[]> {
    return this.teams.list();
  }
}

@Module({ controllers: [TeamsController], providers: [TeamsService] })
export class TeamsModule {}
