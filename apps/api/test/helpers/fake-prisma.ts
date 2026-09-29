/**
 * Tiny in-memory stand-in for the parts of PrismaClient the sync and poller
 * use. Lets those services be tested without a database.
 */
import { randomUUID } from 'node:crypto';

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, cond]) => {
    if (k === 'OR') return (cond as Row[]).some((c) => matches(row, c));
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return (cond.in as unknown[]).includes(row[k]);
      if ('lte' in cond) return row[k] <= cond.lte;
    }
    return row[k] === cond;
  });
}

function table(uniqueKey: string, idKey = 'id') {
  const rows = new Map<string, Row>();
  return {
    rows,
    async upsert({ where, create, update }: { where: Row; create: Row; update: Row }) {
      const key = where[uniqueKey];
      const found = [...rows.values()].find((r) => r[uniqueKey] === key);
      if (found) {
        Object.assign(found, update, { updatedAt: new Date() });
        return { ...found };
      }
      const row: Row = { [idKey]: randomUUID(), ...create, updatedAt: new Date() };
      rows.set(row[idKey], row);
      return { ...row };
    },
    async update({ where, data }: { where: Row; data: Row }) {
      const row = rows.get(where[idKey]);
      if (!row) throw new Error('not found');
      Object.assign(row, data);
      return { ...row };
    },
    async findMany({ where }: { where?: Row } = {}) {
      return [...rows.values()].filter((r) => matches(r, where)).map((r) => ({ ...r }));
    },
    async count({ where }: { where?: Row } = {}) {
      return [...rows.values()].filter((r) => matches(r, where)).length;
    },
    insert(row: Row) {
      const full: Row = { [idKey]: randomUUID(), ...row };
      rows.set(full[idKey], full);
      return full;
    },
  };
}

export function createFakePrisma() {
  const team = table('providerTeamId');
  const venue = table('providerVenueId');
  const tournament = table('providerSeriesId');
  const match = table('providerMatchId');
  const liveScore = table('matchId', 'matchId');

  // match.findMany with `select: { homeTeam: {...}, awayTeam: {...} }` needs joins
  const matchFindMany = match.findMany;
  const findManyWithTeams = async (args: { where?: Row; select?: Row } = {}) => {
    const found = await matchFindMany(args);
    if (!args.select?.homeTeam) return found;
    return found.map((m) => ({
      ...m,
      homeTeam: team.rows.get(m.homeTeamId),
      awayTeam: team.rows.get(m.awayTeamId),
    }));
  };

  return {
    team,
    venue,
    tournament,
    match: { ...match, findMany: findManyWithTeams },
    liveScore,
    async $transaction(ops: Promise<unknown>[]) {
      return Promise.all(ops);
    },
  };
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
