import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/logic.js';
import { boardSvg } from '../src/art.js';

const overlaps = (a, b) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
const bounds = (points, padding) => ({
  left: Math.min(...points.map(p => p[0])) - padding,
  right: Math.max(...points.map(p => p[0])) + padding,
  top: Math.min(...points.map(p => p[1])) - padding,
  bottom: Math.max(...points.map(p => p[1])) + padding,
});
const numbers = value => value.match(/-?\d+(?:\.\d+)?/g).map(Number);

test('rendered short-board artwork stays clear of all number badges and other connections', () => {
  const svg = boardSvg(createGame({ board: 'short' }), 'Board'), artwork = [];
  for (const [, wood] of svg.matchAll(/<g class="ladder">([\s\S]*?)<\/g>/g)) {
    const points = [...wood.matchAll(/<path d="([^"]+)"/g)].flatMap(([, d]) => {
      const values = numbers(d);
      return values.reduce((pairs, value, i) => i % 2 ? pairs : [...pairs, [value, values[i + 1]]], []);
    });
    artwork.push(bounds(points, 5)); // Include the full rail/rung stroke.
  }
  for (const [, snake] of svg.matchAll(/<g class="snake snake-\d">([\s\S]*?)<g class="face">/g)) {
    const [x0, y0, x1, y1, x2, y2, x3, y3] = numbers(snake.match(/class="snake-edge" d="([^"]+)"/)[1]);
    const points = Array.from({ length: 101 }, (_, i) => {
      const t = i / 100, u = 1 - t;
      return [u ** 3 * x0 + 3 * u ** 2 * t * x1 + 3 * u * t ** 2 * x2 + t ** 3 * x3,
        u ** 3 * y0 + 3 * u ** 2 * t * y1 + 3 * u * t ** 2 * y2 + t ** 3 * y3];
    });
    const body = bounds(points, 13); // 12 px stroke radius + conservative sampling margin.
    const [cx, cy, rx, ry] = snake.match(/<ellipse class="snake-head" cx="([^"]+)" cy="([^"]+)" rx="([^"]+)" ry="([^"]+)"/).slice(1).map(Number);
    artwork.push({ left: Math.min(body.left, cx - rx - 1.5), right: Math.max(body.right, cx + rx + 1.5),
      top: Math.min(body.top, cy - ry - 1.5), bottom: Math.max(body.bottom, cy + ry + 1.5) });
  }
  const badges = [...svg.matchAll(/<g class="number"><rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)].map(([, x, y, w, h]) =>
    ({ left: +x, right: +x + +w, top: +y, bottom: +y + +h }));
  assert.equal(artwork.length, 10);
  assert.equal(badges.length, 50);
  for (const [i, shape] of artwork.entries()) {
    assert.ok(shape.left >= 0 && shape.right <= 1000 && shape.top >= 0 && shape.bottom <= 500);
    for (const [j, badge] of badges.entries()) assert.ok(!overlaps(shape, badge), `connection ${i} obscures badge ${j}`);
    for (const other of artwork.slice(i + 1)) assert.ok(!overlaps(shape, other), `connection ${i} touches another connection`);
  }
});
