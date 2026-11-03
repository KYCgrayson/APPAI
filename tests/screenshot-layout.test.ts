import test from 'node:test';
import assert from 'node:assert/strict';
import { usesEditorialScreenshots } from '../src/lib/screenshot-layout.ts';
test('editorial sections opt every screenshot into frames; legacy pages stay legacy', () => {
  for (const type of ['profile-header', 'project-cards', 'entries']) {
    assert.equal(usesEditorialScreenshots([{ type: 'screenshots' }, { type }]), true);
  }
  assert.equal(usesEditorialScreenshots([{ type: 'hero' }, { type: 'screenshots' }]), false);
  assert.equal(usesEditorialScreenshots([]), false);
});

import { legacyScreenshotContent } from '../src/lib/screenshot-layout.ts';
test('legacy screenshots retain heading, image order and numbered alt defaults', () => {
  assert.deepEqual(legacyScreenshotContent({ images: ['first.png', { url: 'second.png', alt: '' }, { url: 'third.png', alt: 'Custom' }] }), {
    heading: 'Screenshots', images: [{ url: 'first.png', alt: 'Screenshot 1' }, { url: 'second.png', alt: 'Screenshot 2' }, { url: 'third.png', alt: 'Custom' }],
  });
  assert.equal(legacyScreenshotContent({ heading: 'Views' }).heading, 'Views');
});

test('legacy screenshots skip malformed items', () => {
  const images = [null, 42, false, {}, 'ok.png', { url: 'next.png' }] as unknown as (string | { url: string })[];
  assert.deepEqual(legacyScreenshotContent({ images }).images, [
    { url: 'ok.png', alt: 'Screenshot 5' }, { url: 'next.png', alt: 'Screenshot 6' },
  ]);
});
