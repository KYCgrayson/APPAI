import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createLeaderboardStore } from '../src/lib/games/leaderboard-store.ts';
import { DAY } from '../src/lib/games/leaderboard.ts';
import { expiredRateLimits } from '../src/lib/rooms-rate-limit.ts';

const knownError = (code: string, meta?: Record<string, unknown>) => new Prisma.PrismaClientKnownRequestError('mock failure', { code, clientVersion: 'test', meta });
function setupStore(failures: unknown[] = [], rawFailures: unknown[] = []) {
  const queries: Prisma.Sql[] = [], executions: Prisma.Sql[] = [], isolation: unknown[] = [];
  let attempts = 0;
  const tx = {
    async $queryRaw(sql: Prisma.Sql) {
      queries.push(sql);
      const failure = rawFailures.shift();
      if (failure) throw failure;
      return sql.sql.includes('AS count FROM') ? [{ count: BigInt(2) }] : [];
    },
  } as unknown as Prisma.TransactionClient;
  const db = {
    async $transaction(fn: (data: Prisma.TransactionClient) => Promise<unknown>, options: unknown) {
      attempts++; isolation.push(options);
      const result = await fn(tx), failure = failures.shift();
      if (failure) throw failure;
      return result;
    },
    async $executeRaw(strings: TemplateStringsArray, ...values: Prisma.Sql['values']) {
      executions.push(Prisma.sql(strings, ...values)); return 0;
    },
  } as unknown as Pick<PrismaClient, '$transaction' | '$executeRaw'>;
  return { store: createLeaderboardStore(db, async () => 1), queries, executions, isolation, attempts: () => attempts };
}

for (const [code, sqlState] of [['P2034'], ['P2002'], ['P2010', '40001'], ['P2010', '40P01']] as const) {
  test(`serializable store retries ${code}${sqlState ? ` SQLSTATE ${sqlState}` : ''} and re-runs the callback`, async () => {
    const t = setupStore([knownError(code, { code: sqlState }), knownError(code, { code: sqlState })]);
    let calls = 0;
    assert.equal(await t.store.transaction(async () => ++calls), 3);
    assert.equal(calls, 3); assert.equal(t.attempts(), 3);
    assert.deepEqual(t.isolation, Array.from({ length: 3 }, () => ({ isolationLevel: 'Serializable' })));
  });
  test(`serializable store bounds retries for ${code}${sqlState ? ` SQLSTATE ${sqlState}` : ''}`, async () => {
    const error = knownError(code, { code: sqlState }), t = setupStore(Array(8).fill(error));
    await assert.rejects(t.store.transaction(async () => 'unused'), candidate => candidate === error);
    assert.equal(t.attempts(), 5);
  });
}
test('serializable store propagates unrelated raw-query errors without retry', async () => {
  for (const error of [knownError('P2010', { code: '23505' }), knownError('P2010'), knownError('P2025'), new Error('offline')]) {
    const t = setupStore([error]);
    await assert.rejects(t.store.transaction(async () => 'unused'), candidate => candidate === error);
    assert.equal(t.attempts(), 1);
  }
});
for (const code of ['40001', '40P01']) test(`SQLSTATE ${code} from a raw rank query replays the transaction`, async () => {
  const error = knownError('P2010', { code }), t = setupStore([], [error, error]);
  const rank = await t.store.transaction(data => data.rank('game', 'board', 'unverified', { score: 80, timeMs: 10_000, achievedAt: new Date() }, 'desc', null));
  assert.equal(rank, 3); assert.equal(t.attempts(), 3); assert.equal(t.queries.length, 3);
});
for (const direction of ['asc', 'desc'] as const) test(`SQL ${direction} rank compares directed score before ascending time/achievement and excludes only the signed-in user`, async () => {
  const t = setupStore(), result = { score: 80, timeMs: 10_000, achievedAt: new Date('2026-11-09T00:00:00Z') };
  for (const userId of ['own-private-id', null]) {
    assert.equal(await t.store.transaction(data => data.rank('game', 'board', 'unverified', result, direction, userId)), 3);
    const query = t.queries.at(-1)!, sql = query.sql.replace(/\s+/g, ' ');
    assert.ok(sql.includes(`s."score" ${direction === 'desc' ? '>' : '<'} ?::int`));
    assert.match(sql, /OR \(s\."score" = \?::int AND \(s\."timeMs", s\."achievedAt"\) < \(\?::int, \?::timestamp\)\)/);
    assert.match(sql, /s\."hidden" = false AND p\."status" = 'active' AND p\."nickname" <> ''/);
    assert.equal(sql.includes('s."userId" <> ?'), userId !== null);
    assert.deepEqual(query.values, ['game', 'board', 'unverified', ...(userId ? [userId] : []), result.score, result.score, result.timeMs, result.achievedAt]);
  }
});
for (const direction of ['asc', 'desc'] as const) test(`SQL ${direction} leaderboard orders directed score with ascending ties before applying the limit`, async () => {
  const t = setupStore();
  await t.store.transaction(data => data.view('game', 'board', 'unverified', 1, 'own-private-id', direction));
  const query = t.queries[0], sql = query.sql.replace(/\s+/g, ' ');
  assert.ok(sql.includes(`row_number() OVER (ORDER BY s."score" ${direction.toUpperCase()}, s."timeMs" ASC, s."achievedAt" ASC, s."id" ASC)`));
  assert.match(sql, /SELECT \* FROM ranked WHERE rank <= \? OR "userId" = \? ORDER BY rank/);
  assert.deepEqual(query.values, ['game', 'board', 'unverified', 1, 'own-private-id']);
});
test('both shared rate cleanup paths expire legacy nickname records normally and keep bounded deletion', async () => {
  const now = new Date('2026-11-09T00:00:00Z'), t = setupStore();
  const expiry = expiredRateLimits(now, DAY);
  assert.match(expiry.sql.replace(/\s+/g, ' '), /^"windowStart" <= \?$/);
  assert.deepEqual(expiry.values, [new Date(+now - DAY)]);
  await t.store.cleanup(now);
  const cleanup = t.executions.find(query => query.sql.includes('GameRoomRateLimit'))!;
  assert.ok(cleanup.sql.includes(expiry.sql)); assert.match(cleanup.sql, /LIMIT 1000/);
  assert.deepEqual(cleanup.values, expiry.values);
  const rooms = readFileSync(new URL('../src/lib/rooms-server.ts', import.meta.url), 'utf8');
  assert.match(rooms, /GameRoomRateLimit.*expiredRateLimits\(now, longestWindowMs\).*LIMIT 1000/);
});
