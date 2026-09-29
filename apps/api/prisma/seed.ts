/**
 * Seed data for local development.
 *
 * Everything here is SAMPLE data: the tournaments, fixtures, scores and
 * broadcaster rights are made up so the app has something to show.
 * Real rights must be entered through the admin panel from official sources.
 *
 * Dates are relative to the moment you run the seed, so the 2 "live" matches
 * are always live. Safe to re-run: rows are upserted by provider id / name.
 */
import { PrismaClient, MatchStatus, Prisma } from '@prisma/client';
import type { InningsDto } from '@cmf/shared';
import {
  DAY, teams, venues, tournaments, matches, broadcasters, rightsIN,
  type TeamKey, type VenueKey, type TournamentKey, type BroadcasterName,
} from './seed-data';

const prisma = new PrismaClient();

// ---------- Run ----------

async function main() {
  const teamIds = {} as Record<TeamKey, string>;
  for (const t of teams) {
    const row = await prisma.team.upsert({
      where: { providerTeamId: `mock-team-${t.key}` },
      update: { name: t.name, shortCode: t.shortCode, country: t.country },
      create: { name: t.name, shortCode: t.shortCode, country: t.country, providerTeamId: `mock-team-${t.key}` },
    });
    teamIds[t.key] = row.id;
  }

  const venueIds = {} as Record<VenueKey, string>;
  for (const v of venues) {
    const data = { name: v.name, city: v.city, country: v.country, timezone: v.timezone };
    const row = await prisma.venue.upsert({
      where: { providerVenueId: `mock-venue-${v.key}` },
      update: data,
      create: { ...data, providerVenueId: `mock-venue-${v.key}` },
    });
    venueIds[v.key] = row.id;
  }

  const tournamentIds = {} as Record<TournamentKey, string>;
  const tournamentDates = {} as Record<TournamentKey, { from: Date; to: Date }>;
  for (const t of tournaments) {
    const data = { name: t.name, format: t.format, season: t.season, startDate: t.startDate, endDate: t.endDate };
    const row = await prisma.tournament.upsert({
      where: { providerSeriesId: `mock-series-${t.key}` },
      update: data,
      create: { ...data, providerSeriesId: `mock-series-${t.key}` },
    });
    tournamentIds[t.key] = row.id;
    tournamentDates[t.key] = { from: t.startDate, to: new Date(t.endDate.getTime() + DAY) };
  }

  const matchIds: Record<string, string> = {};
  for (const m of matches) {
    const data = {
      tournamentId: tournamentIds[m.tournament],
      homeTeamId: teamIds[m.home],
      awayTeamId: teamIds[m.away],
      venueId: venueIds[m.venue],
      matchNo: m.matchNo,
      startTimeUtc: m.start,
      status: m.status,
      tossText: m.toss ?? null,
      resultText: m.result ?? null,
    };
    const row = await prisma.match.upsert({
      where: { providerMatchId: `mock-match-${m.key}` },
      update: data,
      create: { ...data, providerMatchId: `mock-match-${m.key}` },
    });
    matchIds[m.key] = row.id;

    if (m.innings) {
      const inningsJson: InningsDto[] = m.innings.map(({ battingTeamKey, ...rest }) => ({
        battingTeamId: teamIds[battingTeamKey],
        ...rest,
      }));
      const current = m.status === MatchStatus.live ? m.innings[m.innings.length - 1] : null;
      const scoreData = {
        innings: inningsJson as unknown as Prisma.InputJsonValue,
        currentBatters: (current ? current.batting.filter((b) => !b.dismissal) : []) as unknown as Prisma.InputJsonValue,
        currentBowler: current?.bowling[0] ? (current.bowling[0] as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        lastSixBalls: m.lastSix ?? [],
        commentary: (m.commentary ?? []) as unknown as Prisma.InputJsonValue,
      };
      await prisma.liveScore.upsert({
        where: { matchId: row.id },
        update: scoreData,
        create: { matchId: row.id, ...scoreData },
      });
    }
  }

  const broadcasterIds = {} as Record<BroadcasterName, string>;
  for (const b of broadcasters) {
    const data = { type: b.type, appDeeplinkTemplate: b.appDeeplinkTemplate, webUrlTemplate: b.webUrlTemplate };
    const row = await prisma.broadcaster.upsert({ where: { name: b.name }, update: data, create: { name: b.name, ...data } });
    broadcasterIds[b.name] = row.id;
  }

  // Rights: replace the sample IN rights for the seeded tournaments each run
  // (NULL match_id rows can't be upserted through the unique key).
  await prisma.broadcastRight.deleteMany({
    where: { regionCode: 'IN', tournamentId: { in: Object.values(tournamentIds) } },
  });
  await prisma.broadcastRight.createMany({
    data: rightsIN.map((r) => ({
      broadcasterId: broadcasterIds[r.broadcaster],
      tournamentId: tournamentIds[r.tournament],
      matchId: r.matchKey ? matchIds[r.matchKey] : null,
      regionCode: 'IN',
      language: r.language,
      isFree: r.isFree,
      validFrom: tournamentDates[r.tournament].from,
      validTo: tournamentDates[r.tournament].to,
    })),
  });

  const counts = {
    teams: await prisma.team.count(),
    tournaments: await prisma.tournament.count(),
    venues: await prisma.venue.count(),
    matches: await prisma.match.count(),
    liveMatches: await prisma.match.count({ where: { status: MatchStatus.live } }),
    liveScores: await prisma.liveScore.count(),
    broadcasters: await prisma.broadcaster.count(),
    broadcastRightsIN: await prisma.broadcastRight.count({ where: { regionCode: 'IN' } }),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
