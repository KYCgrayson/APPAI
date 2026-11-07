import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { computeTypography, storeTypography, TEXT_STEPS, hasTypography, typographyCss, typographyFactors, TEXT_SIZE_REM } from '../src/lib/typography.ts';
import { createPageSchema, updatePageSchema } from '../src/lib/validations/page.ts';
import { checkPagePreview } from '../src/lib/page-preview.ts';
import { typographyTable } from '../scripts/build-typography-table.mjs';

const page = { slug: 'example', title: 'Example' };
test('all typography steps validate at API level and in content; invalid settings have a field path', () => {
  for (const textSize of TEXT_STEPS) {
    assert.equal(createPageSchema.safeParse({ ...page, textSize, content: { typography: { body: textSize } } }).success, true);
    assert.equal(updatePageSchema.safeParse({ textSize }).success, true);
  }
  for (const invalid of [{ textSize: 'huge' }, { textContrast: 'maximum' }, { typography: { body: 'xxl' } }, { typography: { unknown: 'md' } }]) {
    assert.equal(createPageSchema.safeParse({ ...page, ...invalid }).success, false);
    assert.equal(updatePageSchema.safeParse(invalid).success, false);
    assert.equal(createPageSchema.safeParse({ ...page, content: invalid }).success, false);
    assert.equal(checkPagePreview({ ...page, ...invalid }).valid, false);
  }
});
test('settings persist only in JSON and top-level convenience fields win', () => {
  const stored = storeTypography({ textSize: 'xl', content: { textSize: 'sm', sections: [] } });
  assert.deepEqual(storeTypography({ textSize: 'xl', content: {} }, { sections: ['old'] }), { content: { textSize: 'xl' } });
  assert.deepEqual(stored, { content: { textSize: 'xl', sections: [] } });
  assert.deepEqual(storeTypography({ textContrast: 'high' }, { textSize: 'xl', sections: [] }), { content: { textSize: 'xl', textContrast: 'high', sections: [] } });
});
test('computed sizing respects contrast and overrides, warns without blocking previews', () => {
  assert.equal(computeTypography({ textSize: 'xl' }).desktop.body, 21.12);
  assert.equal(computeTypography({ textContrast: 'high' }).desktop.heading, 60);
  const settings = { textSize: '4xl', typography: { body: 'xs', heading: 'xs', display: 'xs' } } as const;
  const preview = checkPagePreview({ ...page, ...settings });
  assert.equal(preview.valid, true);
  assert.equal(preview.typography?.body, 12);
  assert.ok(preview.warnings.some(w => /below 14px/.test(w.message)));
  const hierarchy = computeTypography({ typography: { body: '4xl', heading: 'xs', display: 'xs' } });
  assert.ok(hierarchy.warnings.some(w => /smaller than body/.test(w.message)));
});
test('extreme typography fits narrow screens and preserves readable body', () => {
  const sizes = computeTypography({ textSize: '4xl', textContrast: 'high', typography: { display: '4xl' } });
  assert.ok(sizes.mobile.display <= 56);
  assert.ok(sizes.mobile.body >= 14);
  assert.equal(sizes.desktop.display, 150);
});
test('documented size table is generated from the pure size module', () => {
  assert.ok(readFileSync(new URL('../docs/spec/typography.md', import.meta.url), 'utf8').includes(typographyTable()));
});

test('relative CSS retains original classes, breakpoints and role-only scope', () => {
  const css = typographyCss({ textSize: 'lg', textContrast: 'high' });
  assert.ok(css.includes('[data-typography-role="heading"].lg\\:text-5xl{font-size:calc(3rem * var(--ts-heading))}'));
  assert.ok(css.indexOf('@media(min-width:640px)') < css.indexOf('@media(min-width:768px)'));
  assert.ok(css.indexOf('@media(min-width:768px)') < css.indexOf('@media(min-width:1024px)'));
  assert.doesNotMatch(css, /:is\(|white-space|max-width:100%/);
  assert.equal(typographyFactors({ typography: { body: 'xl' } }).desktop.display, 1);
  assert.equal(hasTypography({ typography: { body: 'md', heading: 'md' }, textContrast: 'normal' }), false);
  const extreme = typographyFactors({ textSize: '4xl', textContrast: 'high' });
  assert.ok(TEXT_SIZE_REM['text-4xl'] * 16 * extreme.mobile.display <= 56);
  const small = computeTypography({ textSize: 'xs', textContrast: 'low' });
  assert.ok(small.mobile.body >= 14);
  assert.equal(small.warnings.length, 1);
  assert.equal(small.warnings[0].path, 'textSize');
  assert.match(small.warnings[0].message, /desktop.*mobile/);
});

test('generated sizes cover all hosted Tailwind size tokens including arbitrary px', () => {
  const css = typographyCss({ textSize: 'lg' });
  assert.ok(css.includes('.text-\\[13px\\]{font-size:calc(0.8125rem * var(--ts-body))}'));
  assert.ok(css.includes('.prose-sm{font-size:calc(0.875rem * var(--ts-body))}'));
  for (const role of ['caption', 'card', 'body', 'heading', 'display'] as const) {
    const neutral = typographyFactors({ typography: { [role]: 'md' } });
    assert.equal(neutral.desktop[role], 1);
    assert.equal(neutral.mobile[role], 1);
  }
});

 test('extreme typography wraps every role and applies tablet and mobile factors', () => {
  const settings = { textSize: '4xl', textContrast: 'high' } as const;
  const css = typographyCss(settings);
  assert.ok(css.includes('[data-typography="active"] [data-typography-role]{overflow-wrap:anywhere;min-width:0}'));
  assert.doesNotMatch(css, /overflow-wrap:break-word/);
  assert.match(css, /hyphens:auto/);
  const scale = typographyFactors(settings);
  assert.equal(scale.tablet.display, 2.125);
  assert.equal(scale.tablet.heading, 2.125);
  assert.equal(scale.tablet.card, 1.75);
  for (const [viewport, query] of [['tablet', '@media(min-width:640px) and (max-width:1023px)'], ['mobile', '@media(max-width:639px)']] as const) {
    const block = css.slice(css.indexOf(query), css.indexOf(query) + 300);
    for (const role of ['caption', 'card', 'body', 'heading', 'display'] as const) {
      assert.ok(block.includes(`--ts-${role}:${scale[viewport][role]} !important`));
    }
  }
 });
