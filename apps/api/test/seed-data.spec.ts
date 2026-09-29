import { MockStatus as MatchStatus } from '../src/provider/mock/mock-data';
import { teams, venues, tournaments, matches, broadcasters, rightsIN } from '../src/provider/mock/mock-data';

describe('seed data', () => {
  const teamKeys = new Set(teams.map((t) => t.key));
  const venueKeys = new Set(venues.map((v) => v.key));
  const tournamentKeys = new Set(tournaments.map((t) => t.key));
  const broadcasterNames = new Set(broadcasters.map((b) => b.name));

  it('matches the Step 2 spec counts', () => {
    expect(tournaments).toHaveLength(2);
    expect(teams).toHaveLength(8);
    expect(matches).toHaveLength(10);
    expect(matches.filter((m) => m.status === MatchStatus.live)).toHaveLength(2);
    expect(broadcasters).toHaveLength(4);
    expect(rightsIN.length).toBeGreaterThan(0);
  });

  it('has unique keys', () => {
    expect(teamKeys.size).toBe(teams.length);
    expect(new Set(matches.map((m) => m.key)).size).toBe(matches.length);
    expect(broadcasterNames.size).toBe(broadcasters.length);
  });

  it('only references teams, venues and tournaments that exist', () => {
    for (const m of matches) {
      expect(teamKeys.has(m.home)).toBe(true);
      expect(teamKeys.has(m.away)).toBe(true);
      expect(m.home).not.toBe(m.away);
      expect(venueKeys.has(m.venue)).toBe(true);
      expect(tournamentKeys.has(m.tournament)).toBe(true);
    }
  });

  it('puts every match inside its tournament dates', () => {
    const DAY = 24 * 60 * 60 * 1000;
    for (const m of matches) {
      const t = tournaments.find((x) => x.key === m.tournament)!;
      expect(m.start.getTime()).toBeGreaterThanOrEqual(t.startDate.getTime());
      expect(m.start.getTime()).toBeLessThan(t.endDate.getTime() + DAY);
    }
  });

  it('gives live and completed matches a scorecard, upcoming ones none', () => {
    for (const m of matches) {
      if (m.status === MatchStatus.upcoming) expect(m.innings).toBeUndefined();
      else expect(m.innings?.length).toBeGreaterThan(0);
      if (m.status === MatchStatus.completed) expect(m.result).toBeTruthy();
      if (m.status === MatchStatus.live) {
        expect(m.start.getTime()).toBeLessThan(Date.now());
        expect(m.lastSix).toHaveLength(6);
      }
    }
  });

  it('keeps innings batting teams to the two teams playing', () => {
    for (const m of matches) {
      for (const inn of m.innings ?? []) expect([m.home, m.away]).toContain(inn.battingTeamKey);
    }
  });

  it('gives every tournament at least one IN broadcaster and valid overrides', () => {
    for (const t of tournaments) expect(rightsIN.some((r) => r.tournament === t.key && !r.matchKey)).toBe(true);
    for (const r of rightsIN) {
      expect(broadcasterNames.has(r.broadcaster)).toBe(true);
      if (r.matchKey) expect(matches.find((m) => m.key === r.matchKey)?.tournament).toBe(r.tournament);
    }
  });
});
