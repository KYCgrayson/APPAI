import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlobalClient, GlobalError } from '../src/global.ts';
import { logic } from '../src/puzzles/water/logic.ts';

function storage() {
    const map = new Map<string, string>();
    return { map, getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => { map.set(key, value); }, removeItem: (key: string) => { map.delete(key); } };
}
test('global run credentials survive login return; finish records actions and sends bearer, never token in URL', async () => {
    const calls: { url: string; init?: RequestInit }[] = [], saved = storage();
    const fetcher: typeof fetch = async (url, init) => {
        calls.push({ url: String(url), init });
        return Response.json(String(url).endsWith('/runs') ? { runId: 'run-1', token: 'a'.repeat(32), startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString() } :
            String(url).endsWith('/finish') ? { verified: true, score: 6, timeMs: 5000, wouldRank: 1 } :
            { rank: 1, personalBest: true, needsNickname: false });
    };
    const client = createGlobalClient(fetcher, saved), attempt = client.start('water:easy');
    const moves = [{ type: 'select' as const, jug: 0 }, ...logic.solution('easy')];
    const finished = await client.finish(attempt, moves);
    assert.equal(finished?.score, 6); await client.finish(attempt, moves);
    assert.equal(calls.filter(c => c.url.endsWith('/finish')).length, 1);
    assert.deepEqual(JSON.parse(calls[1].init!.body as string).moves, moves);
    assert.equal(new Headers(calls[1].init!.headers).get('authorization'), 'Bearer ' + 'a'.repeat(32));
    assert.equal(calls[1].init!.credentials, 'same-origin');
    const reloaded = createGlobalClient(fetcher, saved), resumed = reloaded.resume('run-1');
    assert.ok(resumed); assert.equal(resumed.board, 'water:easy');
    assert.equal((await reloaded.claim(resumed)).rank, 1);
    assert.ok(calls.every(c => !c.url.includes('a'.repeat(32))));
    assert.equal(client.resume('missing'), null);
});
test('offline API and inaccessible storage never block local play; invalid/expired saved runs are ignored', async () => {
    const offline = createGlobalClient(async () => { throw new Error('offline'); });
    const attempt = offline.start('river:hard');
    assert.equal(await attempt.credentials, null); assert.equal(await offline.finish(attempt, []), null);
    await assert.rejects(() => offline.claim(attempt), (e: unknown) => e instanceof GlobalError && e.code === 'unavailable');
    const saved = storage(); saved.setItem('appai:leaderboard:x', '{bad');
    assert.equal(createGlobalClient(fetch, saved).resume('x'), null);
    saved.setItem('appai:leaderboard:x', JSON.stringify({ runId: 'x', board: 'water:easy', token: 'a'.repeat(32), expiresAt: '2020-01-01' }));
    assert.equal(createGlobalClient(fetch, saved).resume('x'), null);
    const inaccessible = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); }, removeItem: () => {} };
    const okay = createGlobalClient(async () => Response.json({ runId: 'x', token: 'a'.repeat(32), expiresAt: new Date(Date.now() + 10000).toISOString() }), inaccessible);
    assert.ok(await okay.start('water:easy').credentials); assert.equal(okay.resume('x'), null);
});
test('claim exposes the same-tab login callback, nickname errors and board query', async () => {
    const saved = storage(), calls: string[] = [];
    saved.setItem('appai:leaderboard:x', JSON.stringify({ runId: 'x', board: 'water:easy', token: 'a'.repeat(32), expiresAt: new Date(Date.now() + 10000).toISOString() }));
    const client = createGlobalClient(async url => {
        calls.push(String(url));
        if (String(url).endsWith('/claim')) return Response.json({ error: 'login_required', message: 'login', loginUrl: '/login?callbackUrl=%2Fgames%2Friver-crossing%2F%3Fclaim%3Dx' }, { status: 401 });
        if (String(url).endsWith('/profile')) return Response.json({ error: 'nickname_taken', message: 'taken' }, { status: 409 });
        return Response.json({ board: 'water:easy', tier: 'verified', entries: [], total: 0 });
    }, saved);
    await assert.rejects(() => client.claim(client.resume('x')!), (e: unknown) => e instanceof GlobalError && e.code === 'login_required' && e.loginUrl!.includes('callbackUrl'));
    await assert.rejects(() => client.nickname('Maker'), (e: unknown) => e instanceof GlobalError && e.code === 'nickname_taken');
    assert.equal((await client.leaderboard('water:easy', 1)).tier, 'verified');
    assert.ok(calls.some(c => c.includes('board=water%3Aeasy&limit=1')));
});
