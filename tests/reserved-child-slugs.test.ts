import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageSchema } from '../src/lib/validations/page.ts';
test('create and preview schema rejects unreachable child slugs while allowing roots', () => {
  for (const slug of ['en', 'ja', 'fr', 'privacy', 'terms', 'tools']) {
    const result = createPageSchema.safeParse({ slug, title: 'Example', parentSlug: 'root' });
    assert.equal(result.success, false, slug);
    if (!result.success) assert.ok(result.error.issues.some(issue => issue.path.join('.') === 'slug'));
    assert.equal(createPageSchema.safeParse({ slug, title: 'Example' }).success, true);
  }
  assert.equal(createPageSchema.safeParse({ slug: 'project-notes', parentSlug: 'root', title: 'Notes' }).success, true);
});
