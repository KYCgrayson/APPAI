import test from 'node:test';
import assert from 'node:assert/strict';
import { compareToChallenge, isValidRun, cleanName, relativeLuminance, accentTextColor, rank, encodeChallenge, decodeChallenge, formatTime, escapeHtml } from '../src/share/index.ts';
import type { Run } from '../src/share/index.ts';
const run = (crossings = 7, ms = 42000, at = 10): Run => ({ level: 'easy', crossings, ms, at });
test('rank orders crossings, time, and date, filters level, and leaves inputs intact', () => {
 const list = [run(9), run(7, 43000), run(7, 42000, 20), { ...run(), level: 'hard' as const }];
 const fresh = run(); const result = rank(list, fresh);
 assert.deepEqual(result.runs, [fresh, list[2], list[1], list[0]]); assert.equal(result.place, 1); assert.equal(list.length, 4);
});
test('rank limits results and reports a run that falls off', () => {
 const list = [run(), run(7, 41000), run(7, 40000), run(7, 39000), run(7, 38000)];
 assert.equal(rank(list, run(9)).place, null); assert.equal(rank(list, run(9)).runs.length, 5);
 assert.equal(rank(list, run(7, 1), 2).runs.length, 2); assert.equal(rank(list, run(), 0).place, null);
 assert.equal(rank([run()], run()).place, 2);
});
const decode = (query: string) => decodeChallenge(new URLSearchParams(query));
test('challenge round trips, strips dangerous name characters, and handles optional names', () => {
 const c = { level: 'hard' as const, crossings: 13, ms: 83000, name: '小河' };
 assert.deepEqual(decode(encodeChallenge(c)), c);
 assert.deepEqual(decode('challenge=easy&c=7&t=1'), { level: 'easy', crossings: 7, ms: 1000 });
 assert.equal(decode('challenge=easy&c=999&t=86399&n=%20%3C%3E%26%22%27%00Amy%20')?.name, 'Amy');
 assert.equal(decode(encodeChallenge({ ...c, ms: 83999 }))?.ms, 83000);
});
for (const query of [
 '', 'challenge=easy&c=7', 'challenge=easy&t=1', 'c=7&t=1',
 'challenge=unknown&c=7&t=1', 'challenge=__proto__&c=7&t=1', 'challenge=constructor&c=7&t=1',
 'challenge=easy&c=6&t=1', 'challenge=medium&c=10&t=1', 'challenge=hard&c=12&t=1',
 'challenge=easy&c=1000&t=1', 'challenge=easy&c=-7&t=1', 'challenge=easy&c=7.5&t=1', 'challenge=easy&c=7e0&t=1', 'challenge=easy&c=%207&t=1', 'challenge=easy&c=&t=1',
 'challenge=easy&c=7&t=0', 'challenge=easy&c=7&t=86400', 'challenge=easy&c=7&t=-1', 'challenge=easy&c=7&t=1.1', 'challenge=easy&c=7&t=1e1', 'challenge=easy&c=7&t=NaN', 'challenge=easy&c=7&t=',
 'challenge=easy&c=7&t=1&n=1234567890123',
 'challenge=easy&challenge=hard&c=7&t=1', 'challenge=easy&c=7&c=8&t=1', 'challenge=easy&c=7&t=1&t=2', 'challenge=easy&c=7&t=1&n=A&n=B'
]) test(`reject invalid challenge: ${query}`, () => assert.equal(decode(query), null));
test('format times and escape HTML', () => {
 assert.equal(formatTime(0), '0:00'); assert.equal(formatTime(83999), '1:23'); assert.equal(formatTime(3600000), '1:00:00'); assert.equal(formatTime(3661000), '1:01:01');
 assert.equal(escapeHtml(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});

test('challenge comparison uses crossings then whole seconds, including ties', () => {
 const target = { level: 'easy' as const, crossings: 9, ms: 42000 };
 assert.equal(compareToChallenge(8, 99000, target), 'beat');
 assert.equal(compareToChallenge(10, 1000, target), 'behind');
 assert.equal(compareToChallenge(9, 41999, target), 'beat');
 for (const ms of [42000, 42001, 42999]) assert.equal(compareToChallenge(9, ms, target), 'tie');
 assert.equal(compareToChallenge(9, 43000, target), 'behind');
});
test('stored runs reject invalid dates and durations while accepting boundaries', () => {
 assert.equal(isValidRun(run(7, 86399999, 8.64e15)), true);
 for (const ms of [-1, NaN, Infinity, 86400000]) assert.equal(isValidRun(run(7, ms)), false);
 for (const at of [0, -1, NaN, Infinity, 8.64e15 + 1]) assert.equal(isValidRun(run(7, 1000, at)), false);
 for (const value of [null, {}, { ...run(), level: '__proto__' }, run(6)]) assert.equal(isValidRun(value), false);
});
test('names strip bidi and zero-width controls', () => {
 const controls = [0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069, 0xfeff];
 assert.equal(cleanName(' A' + String.fromCodePoint(...controls) + '河 '), 'A河');
});
test('accent text has at least 4.5:1 contrast across RGB luminance ranges', () => {
 assert.equal(relativeLuminance('#000000'), 0);
 assert.equal(relativeLuminance('#ffffff'), 1);
 assert.equal(accentTextColor('#ffffff'), '#000000');
 assert.equal(accentTextColor('#000000'), '#ffffff');
 for (let r = 0; r <= 255; r += 17) for (let g = 0; g <= 255; g += 17) for (let b = 0; b <= 255; b += 17) {
  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  const l = relativeLuminance(hex), text = relativeLuminance(accentTextColor(hex));
  assert.ok((Math.max(l, text) + 0.05) / (Math.min(l, text) + 0.05) >= 4.5, hex);
 }
});
