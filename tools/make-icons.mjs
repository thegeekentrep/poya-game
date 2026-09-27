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
  // Whole-number scale keeps big icons crisp; tiny ones (favicon) shrink the sprite instead.
  const fit = (size * fill) / sw;
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  const bw = Math.round(sw * scale);
  const bh = Math.round(sh * scale);
  const ox = Math.floor((size - bw) / 2);
  const oy = Math.floor((size - bh) / 2);
  const groundY = oy + bh - Math.max(1, Math.round(scale));
  const px = Buffer.alloc(size * size * 4);
  const put = (x, y, [r, g, b]) => px.set([r, g, b, 255], (y * size + x) * 4);

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, hex(y < groundY ? (y < size * 0.18 ? BG : SKY) : GROUND));
  // nearest-neighbour: each icon pixel in the sprite's box samples one sprite pixel
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const ch = sprite.rows[Math.min(sh - 1, Math.floor(y / scale))][Math.min(sw - 1, Math.floor(x / scale))];
      if (ch !== '.') put(ox + x, oy + y, hex(sprite.palette[ch]));
    }
  }
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
