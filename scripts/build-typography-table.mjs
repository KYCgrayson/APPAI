import { computeTypography, TEXT_STEPS, ROLES } from '../src/lib/typography.ts';
import { readFileSync, writeFileSync } from 'node:fs';
export function typographyTable() {
  return '| Step | Scale | Caption | Card | Body | Heading | Display |\n|---|---|---|---|---|---|---|\n' + TEXT_STEPS.map((step, i) => {
    const sizes = computeTypography({ textSize: step }).desktop;
    return `| ${step} | ${[75,87,100,115,132,152,175,200][i]}% | ${ROLES.map(role => role === 'heading' || role === 'display' ? ['low', 'normal', 'high'].map(textContrast => computeTypography({ textSize: step, textContrast }).desktop[role]).join(' / ') : sizes[role]).join(' | ')} |`;
  }).join('\n');
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const path = new URL('../docs/spec/typography.md', import.meta.url);
  writeFileSync(path, readFileSync(path, 'utf8').replace(/<!-- typography-table -->[\s\S]*?<!-- \/typography-table -->|<!-- typography-table -->/, `<!-- typography-table -->\n${typographyTable()}\n<!-- /typography-table -->`));
}
