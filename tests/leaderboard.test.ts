import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOARDS, puzzleLogics, type Board } from '../src/lib/games/boards.ts';
import { createRun, finishRun, claimRun, getLeaderboard, profile, reportScore, leaderboardPreflight, DAY } from '../src/lib/games/leaderboard.ts';
import { normalizeNickname } from '../src/lib/games/nickname.ts';
import { hashToken } from '../src/lib/rooms.ts';
import { leaderboardRateBucket } from '../src/lib/rooms-cors.ts';
import { RESERVED_GAME_SLUGS } from '../src/lib/games-catalog.ts';
import { setup, req } from './helpers/leaderboard-memory.ts';
import type { PuzzleAction } from '../games/puzzle/src/puzzles/types.ts';
const slug = 'river-crossing';
const pointsBoard: Board = { game: 'external-test', key: 'external-test:points', metric: 'points', direction: 'desc', tier: 'unverified', min: 5, max: 100, maxPerSecond: 10 };
type Context = ReturnType<typeof setup>;
async function start(t: Context, board = 'water:easy', game = slug) {
  const response = await createRun(req({ board }), game, t.deps);
  assert.equal(response.status, 201);
  return response.json() as Promise<{ runId: string; token: string; startedAt: string; expiresAt: string }>;
}
async function completed(t: Context, moves: PuzzleAction[] = puzzleLogics.water.solution('easy'), duration = 30_000) {
  const run = await start(t); t.advance(duration);
  const response = await finishRun(req({ moves }, run.token), slug, run.runId, t.deps);
  assert.equal(response.status, 200, JSON.stringify(await response.json()));
  return run;
}
const list = (t: Context, board = 'water:easy', tier = 'verified', limit = '50') => getLeaderboard(req(undefined, undefined, { path: `/api/games/${slug}/leaderboard?board=${board}&tier=${tier}&limit=${limit}` }), slug, t.deps);
const nickname = (t: Context, name: string) => profile(req({ nickname: name }, undefined, { method: 'PUT' }), t.deps);
const pointsList = (t: Context) => getLeaderboard(req(undefined, undefined, { path: `/api/games/${pointsBoard.game}/leaderboard?board=${pointsBoard.key}&tier=unverified&limit=1` }), pointsBoard.game, t.deps);
async function pointsRun(t: Context, score: number, duration = 10_000) {
  const run = await start(t, pointsBoard.key, pointsBoard.game); t.advance(duration);
  const response = await finishRun(req({ score }, run.token), pointsBoard.game, run.runId, t.deps);
  assert.equal(response.status, 200);
  return { ...run, result: await response.json() };
}
for (const board of BOARDS) {
  if (board.tier !== 'verified') continue;
  const logic = puzzleLogics[board.validator], solution = logic.solution(board.level);
  test(`${board.key}: solution verifies to optimal score and server duration; token is hash-only`, async () => {
    const t = setup(), run = await start(t, board.key);
    assert.equal(t.runs.get(run.runId)!.tokenHash, hashToken(run.token));
    assert.ok(!JSON.stringify([...t.runs.values()]).includes(run.token));
    t.advance(60_000);
    const result = await finishRun(req({ moves: solution, score: -999 }, run.token), slug, run.runId, t.deps);
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.equal(data.score, logic.solve(board.level)); assert.equal(data.timeMs, 60_000); assert.equal(data.verified, true);
  });
  for (const [label, moves, duration, status, error] of [
    ['changed step', [{ type: 'invalid' }, ...solution.slice(1)], 60_000, 422, 'replay_failed'],
    ['missing final step', solution.slice(0, -1), 60_000, 422, 'not_won'],
    ['401 actions', Array.from({ length: 401 }, () => ({})), 60_000, 413, 'moves_too_large'],
    ['below animation floor', solution, board.minMsPerMove * solution.filter(a => logic.isMove(a)).length - 1, 422, 'too_fast'],
  ] as const) test(`${board.key}: ${label}`, async () => {
    const t = setup(), run = await start(t, board.key); t.advance(duration);
    const result = await finishRun(req({ moves }, run.token), slug, run.runId, t.deps);
    assert.equal(result.status, status); assert.equal((await result.json()).error, error);
  });
  test(`${board.key}: second finish is already_finished`, async () => {
    const t = setup(), run = await start(t, board.key); t.advance(60_000);
    assert.equal((await finishRun(req({ moves: solution }, run.token), slug, run.runId, t.deps)).status, 200);
    const response = await finishRun(req({ moves: solution }, run.token), slug, run.runId, t.deps);
    assert.equal(response.status, 409); assert.equal((await response.json()).error, 'already_finished');
  });
}
test('claim login callback, nickname gating, public privacy, cache policy and authenticated me', async () => {
  const t = setup(), run = await completed(t);
  const anonymous = await claimRun(req({}, run.token), slug, run.runId, t.deps);
  assert.equal(anonymous.status, 401);
  const login = await anonymous.json(); assert.equal(login.error, 'login_required');
  assert.equal(new URL(login.loginUrl, 'https://appai.info').searchParams.get('callbackUrl'), `/games/${slug}/?claim=${run.runId}`);
  t.signIn('private-user-id');
  const claimed = await (await claimRun(req({}, run.token), slug, run.runId, t.deps)).json();
  assert.equal(claimed.needsNickname, true); assert.equal(claimed.rank, null);
  assert.equal((await (await list(t)).json()).total, 0);
  assert.equal((await nickname(t, '小熊maker')).status, 200);
  const response = await list(t), body = await response.json();
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(body.entries[0].nickname, '小熊maker'); assert.equal(body.entries[0].tier, 'verified'); assert.equal(body.me.rank, 1);
  assert.doesNotMatch(JSON.stringify(body), /userId|email|private-user-id|nicknameKey|tokenHash|reporters/);
  t.signIn(null);
  const publicResponse = await list(t), publicBody = await publicResponse.json();
  assert.equal('me' in publicBody, false); assert.equal(publicResponse.headers.get('cache-control'), 'public, max-age=30');
  assert.match(publicResponse.headers.get('vary')!, /Cookie/);
});
test('best score uses score, then time, then achievedAt; worse claims keep old, better replace', async () => {
  const t = setup(); t.signIn('u1'); await nickname(t, 'Maker');
  const solution = puzzleLogics.water.solution('easy');
  const worse = await completed(t, [{ type: 'fill', jug: 0 }, { type: 'empty', jug: 0 }, ...solution]);
  assert.equal((await (await claimRun(req({}, worse.token), slug, worse.runId, t.deps)).json()).personalBest, true);
  const best = await completed(t, solution);
  assert.equal((await (await claimRun(req({}, best.token), slug, best.runId, t.deps)).json()).personalBest, true);
  const slow = await completed(t, solution, 35_000);
  assert.equal((await (await claimRun(req({}, slow.token), slug, slow.runId, t.deps)).json()).personalBest, false);
  const faster = await completed(t, solution, 10_000);
  assert.equal((await (await claimRun(req({}, faster.token), slug, faster.runId, t.deps)).json()).personalBest, true);
  const tie = await completed(t, solution, 10_000);
  assert.equal((await (await claimRun(req({}, tie.token), slug, tie.runId, t.deps)).json()).personalBest, false);
  assert.equal([...t.scores.values()][0].runId, faster.runId);
});
test('claim stops timer at finish and expires after 24 hours', async () => {
  const t = setup(), run = await completed(t); t.advance(DAY - 1); t.signIn('u1');
  assert.equal((await claimRun(req({}, run.token), slug, run.runId, t.deps)).status, 200);
  assert.equal([...t.scores.values()][0].timeMs, 30_000);
  const expired = await completed(t); t.advance(DAY);
  const response = await claimRun(req({}, expired.token), slug, expired.runId, t.deps);
  assert.equal(response.status, 410); assert.equal((await response.json()).error, 'run_expired');
});
test('wrong token, missing token, wrong slug and missing run are indistinguishable', async () => {
  const t = setup(), run = await start(t);
  for (const [id, token, game] of [[run.runId, 'a'.repeat(32), slug], ['missing', run.token, slug], [run.runId, undefined, slug], [run.runId, run.token, 'other']] as const) {
    const response = await finishRun(req({ moves: [] }, token), game, id, t.deps);
    assert.equal(response.status, 404); assert.equal((await response.json()).error, 'run_not_found');
  }
});
test('concurrent finish/claims award a run only once', async () => {
  const t = setup(), run = await start(t); t.advance(30_000);
  const finishes = await Promise.all([1, 2].map(() => finishRun(req({ moves: puzzleLogics.water.solution('easy') }, run.token), slug, run.runId, t.deps)));
  assert.deepEqual(finishes.map(r => r.status).sort(), [200, 409]);
  t.signIn('u1');
  const claims = await Promise.all([1, 2].map(() => claimRun(req({}, run.token), slug, run.runId, t.deps)));
  assert.deepEqual(claims.map(r => r.status).sort(), [200, 409]); assert.equal(t.scores.size, 1);
});
test('nickname safety, Unicode normalization/casefold, uniqueness and seven-day cooldown', async () => {
  const t = setup(); t.signIn('u1');
  for (const value of ['admin', 'AdM1n', 'a@b', '1234567', 'sh1t', 's.h_1-t', '幹你', '他妈', '死ね', '😀bear', 'hello.com', 'wwwme', 'a  b', ' a', 'a ', 'a']) {
    const response = await nickname(t, value); assert.equal(response.status, 422, value);
  }
  assert.equal((await nickname(t, '小熊maker')).status, 200);
  assert.equal((await nickname(t, 'Different')).status, 429);
  t.signIn('u2'); assert.equal((await nickname(t, '小熊MAKER')).status, 409);
  t.advance(7 * DAY); t.signIn('u1'); assert.equal((await nickname(t, 'New Name')).status, 200);
  t.signIn('u2'); assert.equal((await nickname(t, '小熊Maker')).status, 200);
  assert.deepEqual(normalizeNickname('Ａb\u200b\u202e'), { nickname: 'Ab', nicknameKey: 'ab' });
  assert.equal('error' in normalizeNickname('Sussex'), false);
  assert.deepEqual(normalizeNickname('Straße'), { nickname: 'Straße', nicknameKey: 'strasse' });
  assert.equal('error' in normalizeNickname('猫咪'), false);
  assert.equal('error' in normalizeNickname('नमस्ते'), false);
  for (const emoji of ['㊗️bear', '🇹🇼bear', '1️⃣bear']) assert.equal('error' in normalizeNickname(emoji), true);
});
test('nickname attempts throttle with Retry-After', async () => {
  const t = setup(); t.signIn('u1');
  for (let i = 0; i < 20; i++) await nickname(t, '@@');
  const response = await nickname(t, 'Bear'); assert.equal(response.status, 429); assert.ok(Number(response.headers.get('retry-after')) > 0);
});
test('unverified injected board accepts bounds/rate and stays separate from verified; production has nine verified boards', async () => {
  assert.equal(BOARDS.length, 9); assert.ok(BOARDS.every(b => b.tier === 'verified' && b.game === slug));
  const fake = pointsBoard;
  const t = setup([fake]); t.signIn('u1'); await nickname(t, 'Bear');
  for (const [score, ms, status] of [[50, 10_000, 200], [101, 100_000, 422], [4, 100_000, 422], [50, 1000, 422], [50.1, 10_000, 422]] as const) {
    const run = await start(t, fake.key, fake.game); t.advance(ms);
    const response = await finishRun(req({ score }, run.token), fake.game, run.runId, t.deps);
    assert.equal(response.status, status);
    const body = await response.json();
    if (status === 200) {
      assert.equal(body.verified, false); assert.equal(body.tier, 'unverified');
      assert.equal((await claimRun(req({}, run.token), fake.game, run.runId, t.deps)).status, 200);
    } else assert.equal(body.error, 'replay_failed');
  }
  t.signIn('u2'); await nickname(t, 'Hawk');
  const higher = await pointsRun(t, 80);
  assert.equal(higher.result.wouldRank, 1);
  assert.equal((await claimRun(req({}, higher.token), fake.game, higher.runId, t.deps)).status, 200);
  for (const tier of ['verified', 'unverified']) {
    const response = await getLeaderboard(req(undefined, undefined, { path: `/api/games/external-test/leaderboard?board=${fake.key}&tier=${tier}` }), fake.game, t.deps);
    const body = await response.json(); assert.equal(body.entries.length, tier === 'unverified' ? 2 : 0);
    assert.equal(body.tier, tier);
    if (tier === 'unverified') {
      assert.equal(body.entries[0].tier, tier); assert.equal(body.direction, 'desc');
      assert.deepEqual(body.entries.map((e: { score: number }) => e.score), [80, 50]);
    }
  }
});
test('descending boards rank by score desc, time asc, achievement asc and expose me outside the limit', async () => {
  const t = setup([pointsBoard]);
  for (const [user, score, duration, rank] of [
    ['Low', 30, 10_000, 1], ['Early', 80, 12_000, 1], ['Later', 80, 12_000, 2],
    ['Fast', 80, 10_000, 1], ['High', 90, 20_000, 1],
  ] as const) {
    t.signIn(user); assert.equal((await nickname(t, user)).status, 200);
    const run = await pointsRun(t, score, duration);
    assert.equal(run.result.wouldRank, rank);
    const claimed = await (await claimRun(req({}, run.token), pointsBoard.game, run.runId, t.deps)).json();
    assert.equal(claimed.rank, rank);
  }
  const all = await getLeaderboard(req(undefined, undefined, { path: `/api/games/external-test/leaderboard?board=${pointsBoard.key}&tier=unverified` }), pointsBoard.game, t.deps);
  assert.deepEqual((await all.json()).entries.map((e: { nickname: string }) => e.nickname), ['High', 'Fast', 'Early', 'Later', 'Low']);
  t.signIn('Later');
  const limited = await (await pointsList(t)).json();
  assert.equal(limited.total, 5); assert.equal(limited.entries[0].nickname, 'High'); assert.equal(limited.me.rank, 4);
});
test('descending personal best replaces higher scores and faster ties, keeping worse and later ties', async () => {
  const t = setup([pointsBoard]); t.signIn('owner'); await nickname(t, 'Bear');
  let bestRun = '';
  for (const [score, duration, personalBest, bestScore] of [
    [50, 10_000, true, 50], [40, 5_000, false, 50], [80, 20_000, true, 80],
    [80, 21_000, false, 80], [80, 10_000, true, 80], [80, 10_000, false, 80],
  ] as const) {
    const run = await pointsRun(t, score, duration);
    const response = await claimRun(req({}, run.token), pointsBoard.game, run.runId, t.deps);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.personalBest, personalBest); assert.equal(result.score, bestScore);
    if (personalBest) bestRun = run.runId;
    assert.equal([...t.scores.values()][0].runId, bestRun);
  }
});
for (const direction of ['asc', 'desc'] as const) test(`unverified ${direction} score rate is an upper ceiling, including boundary and zero duration`, async () => {
  const board = { ...pointsBoard, direction, min: 0 }, t = setup([board]);
  for (const [score, duration, status] of [[10, 1_000, 200], [11, 1_000, 422], [1, 1_000, 200], [0, 0, 422]] as const) {
    const run = await start(t, board.key, board.game); t.advance(duration);
    const response = await finishRun(req({ score }, run.token), board.game, run.runId, t.deps);
    assert.equal(response.status, status);
  }
});
for (const direction of ['asc', 'desc'] as const) test(`${direction} wouldRank excludes the signed-in player's row but anonymous ranks count it`, async () => {
  const descending = direction === 'desc', t = setup(descending ? [pointsBoard] : undefined);
  async function finish(duration: number, score: number) {
    if (descending) return pointsRun(t, score, duration);
    const run = await start(t); t.advance(duration);
    const response = await finishRun(req({ moves: puzzleLogics.water.solution('easy') }, run.token), slug, run.runId, t.deps);
    assert.equal(response.status, 200);
    return { ...run, result: await response.json() };
  }
  for (const [user, duration, score] of [['Owner', 10_000, 80], ['Other', 20_000, 60]] as const) {
    t.signIn(user); await nickname(t, user);
    const run = await finish(duration, score);
    assert.equal((await claimRun(req({}, run.token), descending ? pointsBoard.game : slug, run.runId, t.deps)).status, 200);
  }
  t.signIn('Owner'); assert.equal((await finish(25_000, 50)).result.wouldRank, 2);
  assert.equal((await finish(10_000, 80)).result.wouldRank, 1);
  t.signIn(null); assert.equal((await finish(25_000, 50)).result.wouldRank, 3);
  assert.equal((await finish(10_000, 80)).result.wouldRank, 2);
});
test('nickname phone guard rejects separators and Unicode digits after NFKC while allowing short digit suffixes', async () => {
  const t = setup(); t.signIn('owner');
  for (const value of ['0912-345-678', '0912.345.678', '0912 345 678', '0912_345_678', '０９１２－３４５－６７８', '٠٩١٢-٣٤٥-٦٧٨', '०९१२.३४५.६७८', '09_12-3.4 5', 'Bear1234567']) {
    assert.deepEqual(normalizeNickname(value), { error: 'invalid_nickname' }, value);
    assert.equal((await nickname(t, value)).status, 422, value);
  }
  for (const value of ['Bear_2024', 'Bear ２０２４', '猫１２３', 'Bear123456', 'AB12-CD34']) assert.equal('error' in normalizeNickname(value), false, value);
  assert.equal((await nickname(t, 'Bear_2024')).status, 200);
});
test('nickname cooldown survives deletion and daily cleanup without retaining the old nickname', async () => {
  const t = setup(); t.signIn('private-account');
  const saved = await (await nickname(t, 'Old Bear')).json(), key = `lb:nick:${hashToken('private-account')}`;
  assert.equal((await profile(req(undefined, undefined, { method: 'DELETE' }), t.deps)).status, 204);
  assert.equal(t.players.size, 0);
  assert.deepEqual(t.rates.get(key), { start: Date.parse(saved.nextChangeAt) - 7 * DAY, count: 1 });
  assert.doesNotMatch(JSON.stringify([...t.rates.entries()]), /Old Bear|old bear/);
  const blocked = await nickname(t, 'New Bear'); assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), String(7 * DAY / 1000));
  t.advance(DAY); await start(t);
  assert.ok(t.rates.has(key)); assert.equal((await nickname(t, 'New Bear')).status, 429);
  t.signIn('other'); assert.equal((await nickname(t, 'Old Bear')).status, 200);
  t.signIn('private-account'); t.advance(6 * DAY - 1);
  const almost = await nickname(t, 'New Bear'); assert.equal(almost.status, 429); assert.equal(almost.headers.get('retry-after'), '1');
  t.advance(1); await start(t);
  assert.equal(t.rates.has(key), false);
  assert.equal((await nickname(t, 'New Bear')).status, 200);
  const renewed = await nickname(t, 'Next Bear'); assert.equal(renewed.status, 429);
  assert.equal(renewed.headers.get('retry-after'), String(7 * DAY / 1000));
});
test('deleting a legacy profile preserves its original nickname cooldown without extending it', async () => {
  const t = setup(); t.signIn('owner'); await nickname(t, 'Bear');
  const key = `lb:nick:${hashToken('owner')}`, original = t.rates.get(key)!.start;
  t.rates.delete(key); t.advance(2 * DAY);
  assert.equal((await profile(req(undefined, undefined, { method: 'DELETE' }), t.deps)).status, 204);
  assert.equal(t.rates.get(key)!.start, original);
  const blocked = await nickname(t, 'Hawk'); assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get('retry-after'), String(5 * DAY / 1000));
  t.advance(5 * DAY); assert.equal((await nickname(t, 'Hawk')).status, 200);
});
test('nickname conflicts and concurrent attempts do not consume or bypass the cooldown', async () => {
  const t = setup(); t.signIn('other'); await nickname(t, 'Bear');
  t.signIn('owner'); assert.equal((await nickname(t, 'Bear')).status, 409);
  assert.equal(t.rates.has(`lb:nick:${hashToken('owner')}`), false);
  const responses = await Promise.all([nickname(t, 'Hawk'), nickname(t, 'Wolf')]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 429]);
});
test('three distinct reporters hide scores, duplicates do not count, replacement stays hidden', async () => {
  const t = setup(); t.signIn('owner'); await nickname(t, 'Bear');
  const run = await completed(t); await claimRun(req({}, run.token), slug, run.runId, t.deps);
  const score = [...t.scores.values()][0];
  for (const user of ['r1', 'r1', 'r2', 'r3']) {
    t.signIn(user); assert.equal((await reportScore(req({}), slug, score.id, t.deps)).status, 202);
  }
  assert.equal(t.scores.get(score.id)!.reporters.length, 3); assert.equal((await (await list(t)).json()).total, 0);
  t.signIn('owner'); const better = await completed(t, undefined, 10_000); await claimRun(req({}, better.token), slug, better.runId, t.deps);
  assert.equal(t.scores.get(score.id)!.hidden, true);
});
test('profile deletion removes nickname, claimed runs and scores; banned players cannot claim', async () => {
  const t = setup(); t.signIn('u1'); await nickname(t, 'Bear');
  const run = await completed(t); await claimRun(req({}, run.token), slug, run.runId, t.deps);
  const data = await (await profile(req(), t.deps)).json(); assert.equal(data.scores.length, 1); assert.doesNotMatch(JSON.stringify(data), /userId|token|reporters/);
  const response = await profile(req(undefined, undefined, { method: 'DELETE' }), t.deps);
  assert.equal(response.status, 204); assert.equal(await response.text(), ''); assert.equal(t.players.size + t.runs.size + t.scores.size, 0);
  t.advance(7 * DAY);
  assert.equal((await nickname(t, 'Bear')).status, 200); t.players.get('u1')!.status = 'banned';
  t.signIn(null); const other = await completed(t); t.signIn('u1');
  assert.equal((await claimRun(req({}, other.token), slug, other.runId, t.deps)).status, 403);
});
test('run/read limits, CORS preflights and unavailable storage return stable errors', async () => {
  const t = setup();
  for (let i = 0; i < 60; i++) await start(t);
  const response = await createRun(req({ board: 'water:easy' }), slug, t.deps);
  assert.equal(response.status, 429); assert.ok(Number(response.headers.get('retry-after')) > 0);
  for (let i = 0; i < 300; i++) assert.equal((await list(t)).status, 200);
  assert.equal((await list(t)).status, 429);
  const blocked = await createRun(req({ board: 'water:easy' }, undefined, { origin: 'https://evil.example' }), slug, t.deps);
  assert.equal(blocked.status, 403); assert.equal((await blocked.json()).error, 'origin_not_allowed');
  const preflight = await leaderboardPreflight(req(undefined, undefined, { method: 'OPTIONS', origin: 'https://appai.info' }), t.deps);
  assert.equal(preflight.status, 204); assert.match(preflight.headers.get('access-control-allow-methods')!, /PUT, DELETE/);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://appai.info');
  const unconfigured = setup(); unconfigured.deps.env = { NODE_ENV: 'production' };
  assert.equal((await createRun(req({ board: 'water:easy' }), slug, unconfigured.deps)).status, 503);
});
test('8KB streamed body cap, invalid input, unknown boards, limit clamping and slug reservations', async () => {
  const t = setup(), run = await start(t);
  const large = await finishRun(req(undefined, run.token, { raw: JSON.stringify({ moves: [], pad: 'x'.repeat(8192) }) }), slug, run.runId, t.deps);
  assert.equal(large.status, 413); assert.equal((await large.json()).error, 'moves_too_large');
  assert.equal((await createRun(req(undefined, undefined, { raw: '{' }), slug, t.deps)).status, 400);
  assert.equal((await createRun(req({ board: '__proto__' }), slug, t.deps)).status, 400);
  assert.equal((await list(t, 'water:easy', 'other')).status, 400);
  assert.equal((await list(t, 'water:easy', 'verified', '0')).status, 400);
  assert.equal((await list(t, 'water:easy', 'verified', '100')).status, 200);
  assert.ok(RESERVED_GAME_SLUGS.includes('profile')); assert.ok(RESERVED_GAME_SLUGS.includes('boards'));
  assert.equal(leaderboardRateBucket('/api/games/a/runs/x/finish', 'POST'), leaderboardRateBucket('/api/games/b/runs/y/finish', 'POST'));
});
test('opportunistic cleanup clears old moves, expires runs and preserves scores', async () => {
  const t = setup(); t.signIn('u1'); await nickname(t, 'Bear');
  const run = await completed(t); await claimRun(req({}, run.token), slug, run.runId, t.deps);
  t.advance(7 * DAY); await start(t);
  assert.equal(t.runs.get(run.runId)!.moves, null); assert.equal(t.runs.get(run.runId)!.status, 'expired'); assert.equal(t.scores.size, 1);
});
test('migration creates only the three tables and no room changes', () => {
  const sql = readFileSync(new URL('../prisma/game-leaderboard-migration.sql', import.meta.url), 'utf8');
  assert.deepEqual([...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map(m => m[1]), ['GamePlayer', 'GameRun', 'GameScore']);
  assert.doesNotMatch(sql, /ALTER TABLE|GameRoom|GameOrigin/);
});

test('a rejected replay consumes the run; retrying cannot wait out the timing floor', async () => {
  const t = setup(), run = await start(t);
  const first = await finishRun(req({ moves: puzzleLogics.water.solution('easy') }, run.token), slug, run.runId, t.deps);
  assert.equal(first.status, 422); assert.equal((await first.json()).error, 'too_fast');
  t.advance(30_000);
  const retry = await finishRun(req({ moves: puzzleLogics.water.solution('easy') }, run.token), slug, run.runId, t.deps);
  assert.equal(retry.status, 409); assert.equal((await retry.json()).error, 'already_finished');
});
test('claim/report quotas are per account and board, with no run IDs in the bucket key', async () => {
  const t = setup(); t.signIn('u1'); const run = await completed(t);
  t.rates.set('lb:claim-board:u1:water:easy', { start: Date.parse(run.startedAt), count: 30 });
  const limited = await claimRun(req({}, run.token), slug, run.runId, t.deps);
  assert.equal(limited.status, 429); assert.ok(limited.headers.get('retry-after'));
  t.signIn('u2'); assert.equal((await claimRun(req({}, run.token), slug, run.runId, t.deps)).status, 200);
  const next = await completed(t); t.rates.set('lb:claim:u2', { start: Date.parse(next.startedAt), count: 200 });
  assert.equal((await claimRun(req({}, next.token), slug, next.runId, t.deps)).status, 429);
  const id = [...t.scores.values()][0].id;
  t.signIn('reporter'); t.rates.set('lb:report:reporter', { start: Date.parse(next.startedAt), count: 20 });
  assert.equal((await reportScore(req({}), slug, id, t.deps)).status, 429);
});
test('ranking ties use server time and achievement order across players; hidden and banned players stay absent', async () => {
  const t = setup();
  for (const [user, duration] of [['First', 20_000], ['Second', 20_000], ['Fast', 10_000]] as const) {
    t.signIn(user); await nickname(t, user); const run = await completed(t, undefined, duration);
    await claimRun(req({}, run.token), slug, run.runId, t.deps);
  }
  const before = await (await list(t)).json(); assert.deepEqual(before.entries.map((e: { nickname: string }) => e.nickname), ['Fast', 'First', 'Second']);
  t.players.get('Fast')!.status = 'banned'; t.players.get('First')!.status = 'hidden';
  const after = await (await list(t)).json(); assert.equal(after.total, 1); assert.equal(after.entries[0].nickname, 'Second');
});
