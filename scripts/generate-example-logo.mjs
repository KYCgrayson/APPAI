// Deterministic 512x512 RGB PNG: an ivory diamond on an indigo background.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
const crc32 = bytes => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (name, data) => {
  const type = Buffer.from(name), length = Buffer.alloc(4), crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, crc]);
};
const raw = Buffer.alloc(512 * (1 + 512 * 3));
for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
  const color = Math.abs(x - 256) + Math.abs(y - 256) < 144 ? [255, 248, 224] : [79, 70, 229];
  raw.set(color, y * 1537 + 1 + x * 3);
}
const header = Buffer.alloc(13);
header.writeUInt32BE(512, 0); header.writeUInt32BE(512, 4); header[8] = 8; header[9] = 2;
writeFileSync(new URL('../docs/examples/placeholder-logo.png', import.meta.url), Buffer.concat([
  Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
