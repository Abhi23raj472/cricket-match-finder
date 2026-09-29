import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_REGION, type AdminBroadcasterDto, type AdminRightDto, type RightsGapDto } from '@cmf/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateBroadcasterDto, UpdateBroadcasterDto } from './dto/broadcaster.dto';
import type { CreateRightDto, ListRightsQuery, UpdateRightDto } from './dto/right.dto';
import { findRightsGaps, matchLabel, type GapRight } from './rights-gaps';

const DAY = 24 * 60 * 60 * 1000;

const rightInclude = {
  broadcaster: { select: { id: true, name: true } },
  tournament: { select: { id: true, name: true } },
  match: {
    select: {
      id: true,
      matchNo: true,
      startTimeUtc: true,
      homeTeam: { select: { shortCode: true } },
      awayTeam: { select: { shortCode: true } },
    },
  },
} as const;

type RightWithRelations = Prisma.BroadcastRightGetPayload<{ include: typeof rightInclude }>;

function toRightDto(r: RightWithRelations): AdminRightDto {
  return {
    id: r.id,
    broadcaster: r.broadcaster,
    tournament: r.tournament,
    match: r.match ? { id: r.match.id, label: matchLabel(r.match), startTimeUtc: r.match.startTimeUtc.toISOString() } : null,
    regionCode: r.regionCode,
    language: r.language,
    isFree: r.isFree,
    validFrom: r.validFrom.toISOString(),
    validTo: r.validTo.toISOString(),
  };
}

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- broadcasters ----------

  async listBroadcasters(): Promise<AdminBroadcasterDto[]> {
    const rows = await this.prisma.broadcaster.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { rights: true } } },
    });
    return rows.map(({ _count, createdAt: _c, updatedAt: _u, ...b }) => ({ ...b, rightsCount: _count.rights }));
  }

  async createBroadcaster(dto: CreateBroadcasterDto): Promise<AdminBroadcasterDto> {
    try {
      const b = await this.prisma.broadcaster.create({ data: dto });
      return (await this.listBroadcasters()).find((x) => x.id === b.id)!;
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(`A broadcaster named "${dto.name}" already exists`);
      throw e;
    }
  }

  async updateBroadcaster(id: string, dto: UpdateBroadcasterDto): Promise<AdminBroadcasterDto> {
    await this.requireBroadcaster(id);
    try {
      await this.prisma.broadcaster.update({ where: { id }, data: dto });
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException(`A broadcaster named "${dto.name}" already exists`);
      throw e;
    }
    return (await this.listBroadcasters()).find((x) => x.id === id)!;
  }

  /** Only broadcasters with no rights can be deleted; otherwise deactivate them. */
  async deleteBroadcaster(id: string): Promise<void> {
    await this.requireBroadcaster(id);
    const rights = await this.prisma.broadcastRight.count({ where: { broadcasterId: id } });
    if (rights > 0) {
      throw new ConflictException(`This broadcaster has ${rights} right(s). Delete those first, or set isActive=false to hide it.`);
    }
    await this.prisma.broadcaster.delete({ where: { id } });
  }

  private async requireBroadcaster(id: string) {
    const b = await this.prisma.broadcaster.findUnique({ where: { id }, select: { id: true } });
    if (!b) throw new NotFoundException(`Broadcaster ${id} not found`);
  }

  // ---------- rights ----------

  async listRights(q: ListRightsQuery): Promise<AdminRightDto[]> {
    const rows = await this.prisma.broadcastRight.findMany({
      where: {
        ...(q.tournament && { tournamentId: q.tournament }),
        ...(q.broadcaster && { broadcasterId: q.broadcaster }),
        ...(q.region && { regionCode: q.region }),
      },
      include: rightInclude,
      orderBy: [{ tournament: { name: 'asc' } }, { regionCode: 'asc' }, { broadcaster: { name: 'asc' } }, { language: 'asc' }],
    });
    return rows.map(toRightDto);
  }

  async createRight(dto: CreateRightDto): Promise<AdminRightDto> {
    const data = await this.resolveRight(dto);
    await this.assertNoDuplicate(data);
    try {
      return toRightDto(await this.prisma.broadcastRight.create({ data, include: rightInclude }));
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('This right already exists');
      throw e;
    }
  }

  async updateRight(id: string, dto: UpdateRightDto): Promise<AdminRightDto> {
    const existing = await this.prisma.broadcastRight.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Right ${id} not found`);

    const tournamentChanged = dto.tournamentId !== undefined && dto.tournamentId !== existing.tournamentId;
    const merged: CreateRightDto = {
      broadcasterId: dto.broadcasterId ?? existing.broadcasterId,
      tournamentId: dto.tournamentId ?? existing.tournamentId,
      // moving to another tournament drops the old match unless a new one is given
      matchId: dto.matchId !== undefined ? dto.matchId : tournamentChanged ? null : existing.matchId,
      regionCode: dto.regionCode ?? existing.regionCode,
      language: dto.language ?? existing.language,
      isFree: dto.isFree ?? existing.isFree,
      validFrom: dto.validFrom ?? (tournamentChanged ? undefined : existing.validFrom.toISOString()),
      validTo: dto.validTo ?? (tournamentChanged ? undefined : existing.validTo.toISOString()),
    };
    const data = await this.resolveRight(merged);
    await this.assertNoDuplicate(data, id);
    try {
      return toRightDto(await this.prisma.broadcastRight.update({ where: { id }, data, include: rightInclude }));
    } catch (e) {
      if (isUniqueViolation(e)) throw new ConflictException('This right already exists');
      throw e;
    }
  }

  async deleteRight(id: string): Promise<void> {
    const found = await this.prisma.broadcastRight.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw new NotFoundException(`Right ${id} not found`);
    await this.prisma.broadcastRight.delete({ where: { id } });
  }

  /** Checks references and fills default dates. Exported via the service for tests. */
  async resolveRight(dto: CreateRightDto) {
    const [broadcaster, tournament, match] = await Promise.all([
      this.prisma.broadcaster.findUnique({ where: { id: dto.broadcasterId }, select: { id: true } }),
      this.prisma.tournament.findUnique({ where: { id: dto.tournamentId }, select: { id: true, startDate: true, endDate: true } }),
      dto.matchId
        ? this.prisma.match.findUnique({ where: { id: dto.matchId }, select: { id: true, tournamentId: true } })
        : Promise.resolve(null),
    ]);

    const errors: string[] = [];
    if (!broadcaster) errors.push('broadcasterId does not match any broadcaster');
    if (!tournament) errors.push('tournamentId does not match any tournament');
    if (dto.matchId && !match) errors.push('matchId does not match any match');
    if (match && tournament && match.tournamentId !== tournament.id) errors.push('matchId belongs to a different tournament');
    if (errors.length) throw new BadRequestException(errors);

    const validFrom = dto.validFrom ? new Date(dto.validFrom) : tournament!.startDate;
    // Date-only end dates cover the whole day.
    const validTo = dto.validTo
      ? dto.validTo.length === 10
        ? new Date(new Date(dto.validTo).getTime() + DAY - 1)
        : new Date(dto.validTo)
      : new Date(tournament!.endDate.getTime() + DAY - 1);
    if (validFrom >= validTo) throw new BadRequestException(['validFrom must be before validTo']);

    return {
      broadcasterId: dto.broadcasterId,
      tournamentId: dto.tournamentId,
      matchId: dto.matchId ?? null,
      regionCode: dto.regionCode,
      language: dto.language,
      isFree: dto.isFree ?? false,
      validFrom,
      validTo,
    };
  }

  /** The DB unique key can't catch NULL match_id duplicates, so check here. */
  private async assertNoDuplicate(
    data: { broadcasterId: string; tournamentId: string; matchId: string | null; regionCode: string; language: string },
    exceptId?: string,
  ) {
    const dupe = await this.prisma.broadcastRight.findFirst({
      where: {
        broadcasterId: data.broadcasterId,
        tournamentId: data.tournamentId,
        matchId: data.matchId,
        regionCode: data.regionCode,
        language: data.language,
        ...(exceptId && { NOT: { id: exceptId } }),
      },
      select: { id: true },
    });
    if (dupe) {
      throw new ConflictException(
        `This broadcaster already has ${data.language} rights for this ${data.matchId ? 'match' : 'tournament'} in ${data.regionCode}`,
      );
    }
  }

  // ---------- gaps ----------

  /** Upcoming/live matches in the next `days` days with no way to watch in a region. */
  async rightsGaps(days: number, region?: string, now = new Date()): Promise<RightsGapDto[]> {
    const until = new Date(now.getTime() + days * DAY);
    const [matches, rights, regionRows] = await Promise.all([
      this.prisma.match.findMany({
        where: { status: { in: ['upcoming', 'live'] }, startTimeUtc: { lte: until } },
        orderBy: { startTimeUtc: 'asc' },
        select: {
          id: true,
          providerMatchId: true,
          tournamentId: true,
          startTimeUtc: true,
          matchNo: true,
          tournament: { select: { name: true } },
          homeTeam: { select: { shortCode: true } },
          awayTeam: { select: { shortCode: true } },
        },
      }),
      this.prisma.broadcastRight.findMany({ include: { broadcaster: true } }),
      region ? Promise.resolve([]) : this.prisma.broadcastRight.findMany({ distinct: ['regionCode'], select: { regionCode: true } }),
    ]);

    const regions = region ? [region] : [...new Set([DEFAULT_REGION, ...regionRows.map((r) => r.regionCode)])].sort();
    return findRightsGaps(
      matches.map((m) => ({
        id: m.id,
        providerMatchId: m.providerMatchId,
        tournamentId: m.tournamentId,
        tournamentName: m.tournament.name,
        startTimeUtc: m.startTimeUtc,
        label: matchLabel(m),
      })),
      rights as unknown as GapRight[],
      regions,
    );
  }
}
