import type { InningsDto, MatchFormat, MatchStatus, StandingRowDto, TeamDto } from '@cmf/shared';

export interface StandingsMatch {
  status: MatchStatus;
  homeTeamId: string;
  awayTeamId: string;
  innings: InningsDto[];
}

const QUOTA_OVERS: Partial<Record<MatchFormat, number>> = { T20: 20, ODI: 50, T10: 10 };

const oversToBalls = (overs: string) => {
  const [o, b = '0'] = overs.split('.');
  return Number(o) * 6 + Number(b);
};

/**
 * Points table: win 2, tie 1, no result (abandoned) 1, loss 0.
 * Net run rate = runs scored per over - runs conceded per over. A side that
 * is bowled out is treated as facing its full quota of overs (standard rule).
 * Sorted by points, then NRR, then wins, then name.
 */
export function computeStandings(teams: TeamDto[], matches: StandingsMatch[], format: MatchFormat): StandingRowDto[] {
  const quotaBalls = (QUOTA_OVERS[format] ?? 20) * 6;
  const rows = new Map(
    teams.map((team) => [
      team.id,
      { team, played: 0, won: 0, lost: 0, tied: 0, noResult: 0, points: 0, runsFor: 0, ballsFor: 0, runsAgainst: 0, ballsAgainst: 0 },
    ]),
  );

  for (const m of matches) {
    const home = rows.get(m.homeTeamId);
    const away = rows.get(m.awayTeamId);
    if (!home || !away) continue;

    if (m.status === 'abandoned') {
      for (const r of [home, away]) {
        r.played++;
        r.noResult++;
        r.points += 1;
      }
      continue;
    }
    if (m.status !== 'completed' || m.innings.length < 2) continue;

    const [first, second] = m.innings;
    const firstRow = rows.get(first.battingTeamId);
    const secondRow = rows.get(second.battingTeamId);
    if (!firstRow || !secondRow || firstRow === secondRow) continue;

    firstRow.played++;
    secondRow.played++;
    if (first.runs === second.runs) {
      firstRow.tied++;
      secondRow.tied++;
      firstRow.points += 1;
      secondRow.points += 1;
    } else {
      const [winner, loser] = first.runs > second.runs ? [firstRow, secondRow] : [secondRow, firstRow];
      winner.won++;
      winner.points += 2;
      loser.lost++;
    }

    for (const [inn, batting, bowling] of [
      [first, firstRow, secondRow],
      [second, secondRow, firstRow],
    ] as const) {
      const balls = inn.wickets >= 10 ? quotaBalls : oversToBalls(inn.overs);
      batting.runsFor += inn.runs;
      batting.ballsFor += balls;
      bowling.runsAgainst += inn.runs;
      bowling.ballsAgainst += balls;
    }
  }

  return [...rows.values()]
    .map(({ runsFor, ballsFor, runsAgainst, ballsAgainst, ...r }) => {
      const nrr =
        ballsFor && ballsAgainst ? (runsFor / ballsFor) * 6 - (runsAgainst / ballsAgainst) * 6 : 0;
      return { ...r, netRunRate: Math.round(nrr * 1000) / 1000 };
    })
    .sort(
      (a, b) =>
        b.points - a.points || b.netRunRate - a.netRunRate || b.won - a.won || a.team.name.localeCompare(b.team.name),
    );
}
