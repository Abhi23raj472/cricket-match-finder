/**
 * Demo backend that runs in the browser (used for the GitHub Pages build).
 *
 * It reuses the API's own mock provider (ball-by-ball T20 simulation), the
 * Watch-on rules and the points-table maths, so the demo behaves like the
 * real API — but every match, score and broadcaster right is SAMPLE data.
 */
import type {
  BroadcasterDto,
  InningsDto,
  LiveScoreDto,
  MatchDetailDto,
  MatchStatus,
  MatchSummaryDto,
  Paginated,
  TeamDto,
  TournamentDetailDto,
  TournamentListItemDto,
} from '@cmf/shared';
import { MockCricketProvider } from '@cmf/api-src/provider/mock/mock-cricket.provider';
import { broadcasters, rightsIN, teams, tournaments } from '@cmf/api-src/provider/mock/mock-data';
import type { ProviderFixture, ProviderLiveScore } from '@cmf/api-src/provider/cricket-provider.interface';
import { buildWatchOptions, type RightRow } from '@cmf/api-src/matches/watch-options';
import { computeStandings } from '@cmf/api-src/tournaments/standings';

const DAY = 86_400_000;
export const DEMO_TICK_MS = 5_000; // one ball every 5 s so the demo feels alive

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const broadcasterId = (name: string) => `b-${slug(name)}`;

export class DemoServer {
  private provider = new MockCricketProvider();
  private fixtures: ProviderFixture[] = [];
  private scores = new Map<string, ProviderLiveScore>();
  private listeners = new Map<string, Set<(s: LiveScoreDto) => void>>();
  private ready: Promise<void>;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly now: () => number = Date.now) {
    this.ready = this.init();
  }

  private async init() {
    this.fixtures = await this.provider.listFixtures(new Date(this.now() - 60 * DAY), new Date(this.now() + 60 * DAY));
    for (const f of this.fixtures) {
      if (f.status === 'completed') {
        const s = await this.provider.getLiveScore(f.providerMatchId);
        if (s) this.scores.set(f.providerMatchId, s);
      }
    }
    await this.tick();
  }

  /** Bowl one ball in every live match (and start any whose time has come). */
  async tick() {
    for (const f of this.fixtures) {
      const due = f.status === 'live' || (f.status === 'upcoming' && Date.parse(f.startTimeUtc) <= this.now());
      if (!due) continue;
      const s = await this.provider.getLiveScore(f.providerMatchId);
      if (!s) continue;
      f.status = s.status;
      f.tossText = s.tossText ?? f.tossText;
      f.resultText = s.resultText ?? f.resultText;
      this.scores.set(f.providerMatchId, s);
      const dto = this.liveDto(f);
      if (dto) this.listeners.get(f.providerMatchId)?.forEach((l) => l(dto));
    }
  }

  start() {
    if (!this.timer) this.timer = setInterval(() => void this.tick(), DEMO_TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  subscribe(matchId: string, fn: (s: LiveScoreDto) => void): () => void {
    const set = this.listeners.get(matchId) ?? new Set();
    set.add(fn);
    this.listeners.set(matchId, set);
    return () => set.delete(fn);
  }

  // ---------- "HTTP" routes ----------

  async handle(path: string, region: string): Promise<unknown> {
    await this.ready;
    const url = new URL(path, 'http://demo');
    const p = url.pathname;
    let m: RegExpMatchArray | null;

    if (p === '/matches') return this.listMatches(url.searchParams);
    if ((m = p.match(/^\/matches\/([^/]+)$/))) return this.matchDetail(decodeURIComponent(m[1]), region);
    if (p === '/tournaments') return this.listTournaments();
    if ((m = p.match(/^\/tournaments\/([^/]+)$/))) return this.tournamentDetail(decodeURIComponent(m[1]));
    if (p === '/broadcasters') return broadcasters.map((b): BroadcasterDto => ({ id: broadcasterId(b.name), name: b.name, type: b.type, logoUrl: null })).sort((a, b) => a.name.localeCompare(b.name));
    if (p === '/teams') return teams.map((t) => this.team(`mock-team-${t.key}`)).sort((a, b) => a.name.localeCompare(b.name));
    throw new DemoNotFound();
  }

  private listMatches(q: URLSearchParams): Paginated<MatchSummaryDto> {
    const status = q.get('status') as MatchStatus | null;
    const tournament = q.get('tournament');
    const team = q.get('team');
    const pageSize = Math.min(Number(q.get('pageSize') ?? 20), 100);
    let items = this.fixtures.filter(
      (f) =>
        (!status || f.status === status) &&
        (!tournament || f.series.providerSeriesId === tournament) &&
        (!team || f.homeTeam.providerTeamId === team || f.awayTeam.providerTeamId === team),
    );
    const desc = status === 'completed' || status === 'abandoned';
    items = [...items].sort((a, b) => (desc ? -1 : 1) * (Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc)));
    return { items: items.slice(0, pageSize).map((f) => this.summary(f)), total: items.length, page: 1, pageSize };
  }

  private matchDetail(id: string, region: string): MatchDetailDto {
    const f = this.fixtures.find((x) => x.providerMatchId === id);
    if (!f) throw new DemoNotFound();
    const rights: RightRow[] =
      region === 'IN'
        ? rightsIN
            .filter((r) => `mock-series-${r.tournament}` === f.series.providerSeriesId)
            .map((r) => {
              const b = broadcasters.find((x) => x.name === r.broadcaster)!;
              return {
                matchId: r.matchKey ? `mock-match-${r.matchKey}` : null,
                language: r.language,
                isFree: r.isFree,
                broadcaster: {
                  id: broadcasterId(b.name),
                  name: b.name,
                  type: b.type,
                  logoUrl: null,
                  appDeeplinkTemplate: b.appDeeplinkTemplate,
                  webUrlTemplate: b.webUrlTemplate,
                  affiliateUrl: null,
                  isActive: true,
                },
              };
            })
        : [];
    return {
      ...this.summary(f),
      watchOptions: buildWatchOptions(rights, { id, providerMatchId: id }, []),
      live: this.liveDto(f),
    };
  }

  private listTournaments(): TournamentListItemDto[] {
    return tournaments.map((t) => {
      const ms = this.fixtures.filter((f) => f.series.providerSeriesId === `mock-series-${t.key}`);
      return {
        id: `mock-series-${t.key}`,
        name: t.name,
        format: t.format,
        season: t.season,
        startDate: t.startDate.toISOString().slice(0, 10),
        endDate: t.endDate.toISOString().slice(0, 10),
        matchCount: ms.length,
        liveCount: ms.filter((f) => f.status === 'live').length,
      };
    });
  }

  private tournamentDetail(id: string): TournamentDetailDto {
    const t = this.listTournaments().find((x) => x.id === id);
    if (!t) throw new DemoNotFound();
    const ms = this.fixtures.filter((f) => f.series.providerSeriesId === id);
    const teamIds = [...new Set(ms.flatMap((f) => [f.homeTeam.providerTeamId, f.awayTeam.providerTeamId]))];
    const standings = computeStandings(
      teamIds.map((tid) => this.team(tid)),
      ms.map((f) => ({ status: f.status, homeTeamId: f.homeTeam.providerTeamId, awayTeamId: f.awayTeam.providerTeamId, innings: this.innings(f) })),
      t.format,
    );
    const { matchCount: _m, liveCount: _l, ...base } = t;
    return { ...base, standings };
  }

  // ---------- mapping ----------

  private team(providerTeamId: string): TeamDto {
    const t = teams.find((x) => `mock-team-${x.key}` === providerTeamId)!;
    return { id: providerTeamId, name: t.name, shortCode: t.shortCode, country: t.country };
  }

  private innings(f: ProviderFixture): InningsDto[] {
    const s = this.scores.get(f.providerMatchId);
    return (s?.innings ?? []).map((i) => ({
      battingTeamId: i.battingProviderTeamId,
      runs: i.runs,
      wickets: i.wickets,
      overs: i.overs,
      batting: i.batting.map((b) => ({ ...b, dismissal: b.dismissal ?? null })),
      bowling: i.bowling,
    }));
  }

  private summary(f: ProviderFixture): MatchSummaryDto {
    return {
      id: f.providerMatchId,
      tournament: { id: f.series.providerSeriesId, name: f.series.name, format: f.series.format },
      homeTeam: this.team(f.homeTeam.providerTeamId),
      awayTeam: this.team(f.awayTeam.providerTeamId),
      venue: { name: f.venue.name, city: f.venue.city },
      matchNo: f.matchNo ?? null,
      startTimeUtc: f.startTimeUtc,
      status: f.status,
      resultText: f.resultText ?? null,
      scores: this.innings(f).map((i) => ({ teamId: i.battingTeamId, runs: i.runs, wickets: i.wickets, overs: i.overs })),
    };
  }

  private liveDto(f: ProviderFixture): LiveScoreDto | null {
    const s = this.scores.get(f.providerMatchId);
    if (!s) return null;
    return {
      matchId: f.providerMatchId,
      status: s.status,
      tossText: s.tossText ?? null,
      innings: this.innings(f),
      currentBatters: s.currentBatters.map((b) => ({ ...b, dismissal: b.dismissal ?? null })),
      currentBowler: s.currentBowler ?? null,
      lastSixBalls: s.lastSixBalls,
      commentary: s.commentary,
      updatedAt: new Date(this.now()).toISOString(),
    };
  }
}

export class DemoNotFound extends Error {}

let instance: DemoServer | null = null;
export function demoServer(): DemoServer {
  if (!instance) {
    instance = new DemoServer();
    instance.start();
  }
  return instance;
}
