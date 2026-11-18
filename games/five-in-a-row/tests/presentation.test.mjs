import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const rules = new Map([...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) =>
  [selector.trim(), Object.fromEntries([...body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, key, value]) => [key, value.trim()]))]));
function luminance(hex) {
  const rgb = hex.replace('#', '').match(/../g).map((v) => parseInt(v, 16) / 255)
    .map((v) => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) {
  const [dark, light] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (light + .05) / (dark + .05);
}
const hex = (value) => value.match(/#[a-f\d]{6}/i)[0];

test('inline stones have board-matching solid fills on wood badges in both themes', () => {
  const badge = rules.get('.player-stone'), inset = rules.get('.player-stone::before');
  assert.equal(badge.background, 'var(--wood)');
  assert.equal(badge.width, badge.height);
  assert.equal(badge['border-radius'], '50%');
  assert.equal(badge.position, 'relative');
  assert.equal(inset.position, 'absolute');
  assert.equal(inset.inset, '16%', 'wood must remain visible around the whole stone');
  const wood = [...css.matchAll(/--wood:\s*(#[a-f\d]{6})/gi)].map((m) => m[1]);
  for (const color of ['black', 'white']) {
    const stone = rules.get(`.player-stone.${color}::before`);
    const boardStone = rules.get(`.stone.${color}`);
    assert.equal(stone.background, boardStone.background);
    assert.equal(stone.border, boardStone.border);
    assert.match(stone.background, /^radial-gradient\(/);
    if (color === 'black') {
      for (const fill of ['#414844', '#111714']) {
        for (const surface of wood) assert.ok(contrast(fill, surface) > 3);
      }
    } else {
      assert.ok(luminance('#e7e9dd') > .8);
      assert.ok(contrast('#e7e9dd', hex(stone.border)) > 7);
    }
    assert.equal((css.match(new RegExp(`\\.player-stone\\.${color}::before\\s*\\{`, 'g')) ?? []).length, 1);
  }
});

test('winning rings contrast with black stones and their dark outline in every theme', () => {
  const ring = rules.get('.winning .stone');
  assert.match(ring.outline, /solid var\(--win\)/);
  const edge = hex(ring['box-shadow']);
  const colors = [...css.matchAll(/--win:\s*(#[a-f\d]{6})/gi)].map((m) => m[1]);
  assert.ok(colors.length);
  for (const color of colors) {
    assert.ok(contrast(color, edge) > 7);
    for (const black of ['#414844', '#111714']) assert.ok(contrast(color, black) > 7);
  }
  // The dark outer edge remains visible against white stones and either wood.
  for (const surface of ['#e7e9dd', '#e7cb96', '#ba9c68']) assert.ok(contrast(edge, surface) > 5);
});

test('last-move square retains a visible fill at 360 px on a 15 × 15 board', () => {
  const marker = rules.get('.last .stone::before');
  const minimum = Number(marker.width.match(/^clamp\((\d+)px,/)[1]);
  const border = Number(marker.border.match(/^(\d+)px/)[1]);
  assert.equal(marker.height, marker.width);
  assert.ok(minimum - 2 * border >= 5, 'the fill must not disappear inside its border');
  assert.ok(minimum + 2 <= (360 - 28 - 4) / 15 * .77, 'marker and edge fit a phone stone');
  assert.ok(contrast(hex(marker.background), hex(marker.border)) > 10);
});

test('action controls wrap between buttons and retain normal word boundaries in all locales', () => {
  assert.equal(rules.get('.game-actions').display, 'flex');
  assert.equal(rules.get('.game-actions')['flex-wrap'], 'wrap');
  assert.equal(rules.get('.game-actions button')['max-width'], '100%');
  assert.equal(rules.get('button')['overflow-wrap'], 'normal');
  assert.equal(rules.get('button')['word-break'], 'normal');
  assert.doesNotMatch(css, /(?:button|\.game-actions)[^{}]*\{[^{}]*(?:overflow-wrap\s*:\s*anywhere|word-break\s*:\s*break-all)/);
});

test('entry uses an inline favicon rather than requesting /favicon.ico', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<link rel="icon" href="data:,[^"]*">/);
});
