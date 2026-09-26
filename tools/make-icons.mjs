/**
 * Generates the app icons (PNG) from the pixel sprites. No dependencies.
 *   node tools/make-icons.mjs
 * Change ICON_SPECIES or the colours below to restyle the icon.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { SPRITES } from '../src/sprites/animals.js';

const ICON_SPECIES = 'wolf';
const BG = '#1a1c2c';
const GROUND = '#38b764';
const SKY = '#29366f';

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

function png(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** fill: fraction of the icon the sprite should span (maskable icons need a safe margin). */
function render(size, fill) {
  const sprite = SPRITES[ICON_SPECIES];
  const sw = sprite.rows[0].length;
  const sh = sprite.rows.length;
  const scale = Math.max(1, Math.floor((size * fill) / sw));
  const ox = Math.floor((size - sw * scale) / 2);
  const oy = Math.floor((size - sh * scale) / 2);
  const groundY = oy + sh * scale - scale;
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, [r, g, b]) => px.set([r, g, b, 255], (y * size + x) * 4);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, hex(y < groundY ? (y < size * 0.18 ? BG : SKY) : GROUND));
  sprite.rows.forEach((row, sy) => {
    for (let sx = 0; sx < sw; sx++) {
      const ch = row[sx];
      if (ch === '.') continue;
      const color = hex(sprite.palette[ch]);
      for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) put(ox + sx * scale + dx, oy + sy * scale + dy, color);
    }
  });
  return png(size, px);
}

mkdirSync('icons', { recursive: true });
const outputs = [
  ['icons/icon-192.png', 192, 0.8],
  ['icons/icon-512.png', 512, 0.8],
  ['icons/maskable-512.png', 512, 0.6],
  ['icons/apple-touch-icon.png', 180, 0.8],
  ['icons/favicon-32.png', 32, 0.95],
];
for (const [file, size, fill] of outputs) {
  writeFileSync(file, render(size, fill));
  console.log('wrote', file);
}
