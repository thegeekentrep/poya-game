/**
 * Colosseum battle background: sandstone colonnade, tiered stands with a central
 * stairway, angled side stands, an arched arena wall and a mottled sand floor.
 *
 * The stonework is drawn once per stage size into a cached layer; only the
 * cheering crowd is redrawn each frame. Layout is in fractions of the stage
 * height so it scales with the canvas (designed for 192×104).
 */
const STONE = {
  void: '#2e1f1a',
  s0: '#5a3d2b',
  s1: '#7d5a3c',
  s2: '#a57c52',
  s3: '#c49a6c',
  s4: '#dcb88a',
  s5: '#ecd3a5',
};
const SAND = { shadow: '#8a6440', dark: '#a98050', base: '#c9a06e', light: '#dbb888' };

// Bottom edge of each band, as a fraction of stage height (top to bottom).
const LAYOUT = {
  rim: 0.02,
  colonnade: 0.14,
  upperStands: 0.285,
  ledge: 0.325,
  midColonnade: 0.375,
  lowerStands: 0.45,
  lowerLedge: 0.48,
  wall: 0.665, // floor starts here
};

const ARCH_SPACING = 42; // px between wall arches
const PILLAR_SPACING = 12;

// Spectators: x as a fraction of width, feet as a fraction of height.
const CROWD = [
  { x: 0.27, y: 0.19, hat: '#38b764', body: '#8a4a2a' },
  { x: 0.66, y: 0.19, hat: '#38b764', body: '#8a4a2a' },
  { x: 0.56, y: 0.2, hat: '#257179', body: '#5d275d', pointy: true },
  { x: 0.41, y: 0.245, hat: '#e8e0d0', body: '#257179' },
  { x: 0.37, y: 0.28, hat: '#38b764', body: '#8a4a2a' },
  { x: 0.41, y: 0.28, hat: '#257179', body: '#5d275d', pointy: true },
  { x: 0.57, y: 0.28, hat: '#38b764', body: '#8a4a2a' },
  { x: 0.3, y: 0.445, hat: '#257179', body: '#5d275d', pointy: true },
  { x: 0.72, y: 0.445, hat: '#b13e53', body: '#29366f' },
];
const SKIN = '#f0c090';

// ── helpers ──────────────────────────────────────────────
const hash2 = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};

function valueNoise(x, y, cw, ch) {
  const gx = x / cw;
  const gy = y / ch;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const sx = (gx - x0) ** 2 * (3 - 2 * (gx - x0));
  const sy = (gy - y0) ** 2 * (3 - 2 * (gy - y0));
  const top = hash2(x0, y0) * (1 - sx) + hash2(x0 + 1, y0) * sx;
  const bottom = hash2(x0, y0 + 1) * (1 - sx) + hash2(x0 + 1, y0 + 1) * sx;
  return top * (1 - sy) + bottom * sy;
}

function fill(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function speckle(ctx, x0, y0, w, h, color, density, seed = 0) {
  ctx.fillStyle = color;
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) if (hash2(x + seed * 17.3, y - seed * 9.1) < density) ctx.fillRect(x, y, 1, 1);
  }
}

// ── stonework bands ──────────────────────────────────────
function drawColonnade(ctx, w, y0, y1, c) {
  fill(ctx, STONE.s5, 0, 0, w, 1);
  fill(ctx, STONE.s4, 0, 1, w, y0 - 1);
  fill(ctx, STONE.s3, 0, y0, w, y1 - y0);
  speckle(ctx, 0, y0, w, y1 - y0, STONE.s2, 0.14, 1);
  fill(ctx, STONE.s1, 0, y0, w, 1);

  for (let px = 2; px < w; px += PILLAR_SPACING) {
    if (Math.abs(px + 2 - c) < 14) continue; // leave room for the central doorway
    fill(ctx, STONE.s4, px, y0 + 1, 4, y1 - y0 - 2);
    fill(ctx, STONE.s5, px, y0 + 1, 1, y1 - y0 - 2);
    fill(ctx, STONE.s1, px + 4, y0 + 2, 1, y1 - y0 - 3);
    fill(ctx, STONE.s5, px - 1, y0 + 1, 6, 1); // capital
    fill(ctx, STONE.s4, px - 1, y1 - 3, 6, 2); // base
  }

  // central doorway with pediment
  fill(ctx, STONE.s2, c - 11, y0, 22, y1 - y0);
  fill(ctx, STONE.s1, c - 11, y0, 1, y1 - y0);
  fill(ctx, STONE.s1, c + 10, y0, 1, y1 - y0);
  for (let i = 0; i < 3; i++) fill(ctx, STONE.s4, c - 2 - i * 2, y0 + 1 + i, 4 + i * 4, 1);
  fill(ctx, STONE.s1, c - 8, y0 + 4, 16, 1);
  fill(ctx, STONE.s3, c - 8, y0 + 5, 1, y1 - y0 - 5);
  fill(ctx, STONE.s3, c + 7, y0 + 5, 1, y1 - y0 - 5);
  fill(ctx, STONE.void, c - 4, y0 + 6, 8, y1 - y0 - 6);
  fill(ctx, STONE.s0, c - 4, y0 + 6, 8, 1);
  fill(ctx, STONE.s1, 0, y1 - 1, w, 1);
}

function drawStands(ctx, w, y0, y1, c) {
  const rows = [STONE.s4, STONE.s3, STONE.s1];
  for (let y = y0; y < y1; y++) fill(ctx, rows[(y - y0) % 3], 0, y, w, 1);
  speckle(ctx, 0, y0, w, y1 - y0, STONE.s2, 0.05, 2);
  // central stairway
  for (let y = y0; y < y1; y++) fill(ctx, y % 2 ? STONE.s4 : STONE.s3, c - 6, y, 12, 1);
  fill(ctx, STONE.s1, c - 7, y0, 1, y1 - y0);
  fill(ctx, STONE.s1, c + 6, y0, 1, y1 - y0);
  fill(ctx, STONE.s5, c - 6, y0, 1, y1 - y0);
}

function drawLedge(ctx, w, y0, y1) {
  fill(ctx, STONE.s2, 0, y0, w, y1 - y0);
  speckle(ctx, 0, y0, w, y1 - y0, STONE.s1, 0.25, 3);
  speckle(ctx, 0, y0, w, y1 - y0, STONE.s3, 0.2, 4);
  fill(ctx, STONE.s4, 0, y0, w, 1);
  fill(ctx, STONE.s1, 0, y1 - 1, w, 1);
}

function drawMidColonnade(ctx, w, y0, y1) {
  fill(ctx, STONE.s1, 0, y0, w, y1 - y0);
  speckle(ctx, 0, y0, w, y1 - y0, STONE.s0, 0.3, 5);
  for (let px = 3; px < w; px += 9) {
    fill(ctx, STONE.s3, px, y0, 2, y1 - y0);
    fill(ctx, STONE.s4, px, y0, 1, y1 - y0);
  }
  fill(ctx, STONE.s3, 0, y0, w, 1);
  fill(ctx, STONE.s2, 0, y1 - 1, w, 1);
}

function drawCenterArch(ctx, c, top, bottom) {
  fill(ctx, STONE.s4, c - 6, top, 12, bottom - top);
  fill(ctx, STONE.s5, c - 1, top - 1, 2, 1); // keystone
  fill(ctx, STONE.void, c - 3, top + 1, 6, 1);
  fill(ctx, STONE.void, c - 4, top + 2, 8, bottom - top - 2);
  fill(ctx, STONE.s0, c - 4, top + 2, 1, bottom - top - 2);
}

function drawSides(ctx, w, top, bottom) {
  const stripes = [STONE.s4, STONE.s3, STONE.s1];
  const railX = (y) => Math.round(10 + ((y - top) * 22) / (bottom - top));
  for (let y = top; y < bottom; y++) {
    const rx = railX(y);
    for (let x = 0; x < rx; x++) {
      const color = stripes[(y + Math.floor(x / 2)) % 3];
      fill(ctx, color, x, y, 1, 1);
      fill(ctx, color, w - 1 - x, y, 1, 1);
    }
    // the diagonal stone rail
    fill(ctx, STONE.s5, rx, y, 1, 1);
    fill(ctx, STONE.s4, rx + 1, y, 1, 1);
    fill(ctx, STONE.s1, rx + 2, y, 1, 1);
    fill(ctx, STONE.s5, w - 1 - rx, y, 1, 1);
    fill(ctx, STONE.s4, w - 2 - rx, y, 1, 1);
    fill(ctx, STONE.s1, w - 3 - rx, y, 1, 1);
  }
}

function drawArch(ctx, xc, top, bottom, withDoor) {
  const hw = 11;
  // outline
  fill(ctx, STONE.s1, xc - hw - 1, top + 2, hw * 2 + 2, bottom - top - 2);
  fill(ctx, STONE.s1, xc - hw + 1, top + 1, hw * 2 - 2, 1);
  fill(ctx, STONE.s1, xc - hw + 4, top, hw * 2 - 8, 1);
  // recessed panel
  fill(ctx, STONE.s4, xc - hw, top + 3, hw * 2, bottom - top - 3);
  fill(ctx, STONE.s4, xc - hw + 2, top + 2, hw * 2 - 4, 1);
  fill(ctx, STONE.s4, xc - hw + 5, top + 1, hw * 2 - 10, 1);
  fill(ctx, STONE.s2, xc - hw, top + 3, 2, bottom - top - 3);
  speckle(ctx, xc - hw + 2, top + 2, hw * 2 - 2, bottom - top - 2, STONE.s3, 0.12, xc);
  if (withDoor) {
    fill(ctx, STONE.s2, xc - 6, top + 4, 12, bottom - top - 4);
    fill(ctx, STONE.void, xc - 4, top + 6, 8, bottom - top - 6);
    fill(ctx, STONE.void, xc - 3, top + 5, 6, 1);
  }
}

function drawWall(ctx, w, y0, y1, c) {
  fill(ctx, STONE.s3, 0, y0, w, y1 - y0);
  for (let y = y0 + 2, row = 0; y < y1; y += 3, row++) {
    fill(ctx, STONE.s2, 0, y, w, 1);
    for (let x = (row % 2) * 3; x < w; x += 6) fill(ctx, STONE.s2, x, y - 2, 1, 2);
  }
  speckle(ctx, 0, y0, w, y1 - y0, STONE.s4, 0.06, 6);
  fill(ctx, STONE.s4, 0, y0, w, 1);
  fill(ctx, STONE.s1, 0, y0 + 1, w, 1);
  for (let k = -2; k <= 2; k++) drawArch(ctx, c + k * ARCH_SPACING, y0 + 3, y1, k === 0);
}

function drawFloor(ctx, w, y0, h) {
  for (let y = y0; y < h; y++) {
    const depth = y - y0;
    const cw = 5 + depth * 0.15; // blotches get bigger as they come closer
    for (let x = 0; x < w; x++) {
      const n = valueNoise(x, y, cw, cw / 2) * 0.75 + hash2(x, y) * 0.25;
      fill(ctx, n > 0.62 ? SAND.dark : n < 0.3 ? SAND.light : SAND.base, x, y, 1, 1);
    }
  }
  fill(ctx, SAND.shadow, 0, y0, w, 1);
  speckle(ctx, 0, y0 + 1, w, 2, SAND.shadow, 0.35, 7);
}

// ── cached static layer ──────────────────────────────────
const layers = new Map();

function buildLayer(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const c = Math.floor(w / 2);
  const Y = Object.fromEntries(Object.entries(LAYOUT).map(([k, f]) => [k, Math.round(f * h)]));

  drawColonnade(ctx, w, Y.rim, Y.colonnade, c);
  drawStands(ctx, w, Y.colonnade, Y.upperStands, c);
  drawLedge(ctx, w, Y.upperStands, Y.ledge);
  drawMidColonnade(ctx, w, Y.ledge, Y.midColonnade);
  drawStands(ctx, w, Y.midColonnade, Y.lowerStands, c);
  drawLedge(ctx, w, Y.lowerStands, Y.lowerLedge);
  drawCenterArch(ctx, c, Y.upperStands + 1, Y.midColonnade);
  drawSides(ctx, w, Y.rim + 6, Y.lowerLedge);
  drawWall(ctx, w, Y.lowerLedge, Y.wall, c);
  drawFloor(ctx, w, Y.wall, h);
  return canvas;
}

function drawSpectator(ctx, s, i, w, h, t) {
  const cheering = Math.sin(t * 6 + i * 1.7) > 0.2;
  const x = Math.round(s.x * w);
  const y = Math.round(s.y * h) - (cheering ? 1 : 0);
  if (s.pointy) fill(ctx, s.hat, x, y - 7, 1, 1);
  fill(ctx, s.hat, x - 1, y - 6, 3, 1);
  fill(ctx, SKIN, x - 1, y - 5, 3, 1);
  fill(ctx, s.body, x - 1, y - 4, 3, 3);
  fill(ctx, STONE.s0, x - 1, y - 1, 1, 1);
  fill(ctx, STONE.s0, x + 1, y - 1, 1, 1);
  if (cheering) {
    fill(ctx, SKIN, x - 2, y - 6, 1, 2);
    fill(ctx, SKIN, x + 2, y - 6, 1, 2);
  } else {
    fill(ctx, s.body, x - 2, y - 4, 1, 2);
    fill(ctx, s.body, x + 2, y - 4, 1, 2);
  }
}

export function arena(ctx, w, h, t) {
  const key = `${w}x${h}`;
  if (!layers.has(key)) layers.set(key, buildLayer(w, h));
  ctx.drawImage(layers.get(key), 0, 0);
  CROWD.forEach((s, i) => drawSpectator(ctx, s, i, w, h, t));
}
