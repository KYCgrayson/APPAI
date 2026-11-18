// Offline build utility. sharp is already supplied by Next.js; no app dependency added.
// Run: node scripts/generate-game-social-images.mjs
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { GAMES, TABLETOP_COLLECTION } from '../src/lib/games-catalog.ts';

for (const cover of new Set([...GAMES, TABLETOP_COLLECTION].map(game => game.cover))) {
  const input = new URL(`../public${cover}`, import.meta.url);
  const output = new URL(`../public${cover.replace(/\.svg$/, '.png')}`, import.meta.url);
  await sharp(await readFile(input), { density: 144 })
    .resize(1200, 630, { fit: 'contain', background: '#0f172a' })
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(output.pathname);
  console.log(`${cover.replace(/\.svg$/, '.png')} (1200×630)`);
}
