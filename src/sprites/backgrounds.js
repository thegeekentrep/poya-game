/**
 * Procedural pixel backgrounds. Each takes (ctx, width, height, timeSeconds).
 * The colosseum lives in its own file: arena.js.
 */
import { arena } from './arena.js';

const DAY_SKY = ['#41a6f6', '#5ab8f7', '#73eff7'];
const NIGHT_SKY = ['#1a1c2c', '#29366f', '#333c57'];

// deterministic pseudo-random so stars don't jump around between frames
const hash = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function isNight() {
  const hour = new Date().getHours();
  return hour < 6 || hour >= 19;
}

function cloud(ctx, x, y) {
  ctx.fillRect(x + 2, y, 8, 2);
  ctx.fillRect(x, y + 2, 14, 2);
  ctx.fillRect(x + 4, y - 2, 4, 2);
}

export function meadow(ctx, w, h, t) {
  const night = isNight();
  const sky = night ? NIGHT_SKY : DAY_SKY;
  const horizon = Math.floor(h * 0.62);
  const band = Math.ceil(horizon / sky.length);
  sky.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(0, i * band, w, band);
  });

  if (night) {
    ctx.fillStyle = '#f4f4f4';
    for (let i = 0; i < 18; i++) {
      if (Math.sin(t * 2 + i * 7) > 0.92) continue; // twinkle
      ctx.fillRect(Math.floor(hash(i) * w), Math.floor(hash(i + 50) * (horizon - 8)), 1, 1);
    }
    ctx.fillStyle = '#ffcd75';
    ctx.fillRect(w - 20, 6, 6, 6);
    ctx.fillStyle = sky[0];
    ctx.fillRect(w - 18, 5, 5, 5);
  } else {
    ctx.fillStyle = '#ffcd75';
    ctx.fillRect(w - 20, 6, 8, 8);
    ctx.fillRect(w - 21, 8, 10, 4);
    ctx.fillRect(w - 18, 5, 4, 10);
    ctx.fillStyle = '#f4f4f4';
    cloud(ctx, Math.floor(((t * 3) % (w + 30)) - 20), 10);
    cloud(ctx, Math.floor(((t * 2 + w / 2) % (w + 30)) - 20), 20);
  }

  // hills
  ctx.fillStyle = night ? '#1f4d52' : '#257179';
  for (let x = 0; x < w; x++) {
    const top = horizon - 5 - Math.round(Math.sin(x / 9) * 2 + Math.sin(x / 4 + 1) * 1);
    ctx.fillRect(x, top, 1, horizon - top);
  }

  // ground
  ctx.fillStyle = night ? '#257179' : '#38b764';
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.fillStyle = night ? '#1f4d52' : '#257179';
  for (let y = horizon + 4; y < h; y += 6) {
    for (let x = (y * 3) % 11; x < w; x += 11) ctx.fillRect(x, y, 3, 1);
  }
  ctx.fillStyle = night ? '#38b764' : '#a7f070';
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(hash(i + 200) * w);
    const y = horizon + 2 + Math.floor(hash(i + 300) * (h - horizon - 4));
    ctx.fillRect(x, y, 1, 2);
    ctx.fillRect(x + 2, y + 1, 1, 1);
  }
}

export const BACKGROUNDS = { meadow, arena };
