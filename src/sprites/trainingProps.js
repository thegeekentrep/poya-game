/**
 * Pixel-art props for the training stations. Each function draws straight onto
 * a canvas context in stage pixels; `groundY` is where pets' feet rest.
 * Behaviour (what moves when) lives in ui/components/trainingScenes.js.
 */
const INK = '#1a1c2c';
const STONE = ['#f4f4f4', '#94b0c2', '#566c86', '#333c57'];
const WOOD = { light: '#d8a066', mid: '#a2653c', dark: '#7c4b2f', deep: '#4e2e23' };
const WATER = ['#f4f4f4', '#73eff7', '#41a6f6', '#3b5dc9'];

const hash = (n) => {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
};

function rect(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ── Boulder Moving ────────────────────────────────────────────────

export function dirtTrack(ctx, w, top, bottom) {
  rect(ctx, '#8a5a36', 0, top, w, bottom - top);
  rect(ctx, '#a2653c', 0, top, w, 2);
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(hash(i + 10) * w);
    const y = top + 3 + Math.floor(hash(i + 60) * (bottom - top - 4));
    rect(ctx, hash(i) > 0.5 ? '#6e4527' : '#b87b4a', x, y, hash(i + 5) > 0.6 ? 2 : 1, 1);
  }
}

/** A shaded boulder resting on groundY, rolled by `angle` radians. */
export function boulder(ctx, cx, groundY, r, angle = 0) {
  const cy = groundY - r;
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.hypot(x, y * 1.1);
      if (d > r) continue;
      const light = (x + y) / (r * 1.4); // lit from the top-left
      const color = d > r - 1.2 ? INK : light < -0.45 ? STONE[1] : light < 0.35 ? STONE[2] : STONE[3];
      rect(ctx, color, cx + x, cy + y, 1, 1);
    }
  }
  // cracks and specks turn as it rolls
  for (let k = 0; k < 5; k++) {
    const a = angle + k * 1.3;
    const dist = r * (0.3 + 0.12 * k);
    const x = cx + Math.cos(a) * dist;
    const y = cy + Math.sin(a) * dist * 0.9;
    rect(ctx, k % 2 ? STONE[3] : INK, x, y, 2, 1);
    if (k === 1) rect(ctx, INK, x + Math.cos(a + 1.5) * 2, y + Math.sin(a + 1.5) * 2, 1, 2);
  }
  rect(ctx, STONE[0], cx - r * 0.45, cy - r * 0.55, 3, 2);
}

export function finishFlag(ctx, x, groundY, t) {
  rect(ctx, INK, x, groundY - 34, 2, 34);
  const wave = Math.round(Math.sin(t * 6));
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      rect(ctx, (row + col) % 2 ? INK : '#f4f4f4', x + 2 + col * 3, groundY - 33 + row * 3 + (col > 1 ? wave : 0), 3, 3);
    }
  }
}

// ── Waterfall ─────────────────────────────────────────────────────

/** A rocky cliff face spanning [x0, x1], from the top of the stage down to groundY. */
export function cliff(ctx, x0, x1, groundY) {
  rect(ctx, '#333c57', x0, 0, x1 - x0, groundY);
  for (let i = 0; i < 26; i++) {
    const x = x0 + Math.floor(hash(i + 90) * (x1 - x0 - 10));
    const y = Math.floor(hash(i + 140) * (groundY - 8));
    const w = 6 + Math.floor(hash(i + 7) * 10);
    rect(ctx, '#566c86', x, y, w, 3);
    rect(ctx, '#1a1c2c', x, y + 3, w, 1);
  }
  // mossy edges
  for (let y = 0; y < groundY; y += 5) {
    rect(ctx, '#257179', x0 - 1, y + Math.floor(hash(y) * 3), 3, 2);
    rect(ctx, '#257179', x1 - 2, y + Math.floor(hash(y + 3) * 3), 3, 2);
  }
}

/** Falling water between x and x + w, from y0 to y1. */
export function waterStream(ctx, x, w, y0, y1, t, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  rect(ctx, WATER[2], x, y0, w, y1 - y0);
  for (let col = 0; col < w; col++) {
    const speed = 70 + hash(col) * 40;
    const offset = (t * speed + hash(col + 20) * 40) % 14;
    for (let y = y0 - 14 + offset; y < y1; y += 14) {
      const top = Math.max(y, y0);
      const len = Math.min(y + 6, y1) - top;
      if (len > 0) rect(ctx, col % 3 === 0 ? WATER[0] : WATER[1], x + col, top, 1, len);
    }
  }
  ctx.restore();
}

export function plungePool(ctx, cx, groundY, w, t) {
  const top = groundY - 5;
  rect(ctx, WATER[3], cx - w / 2, top, w, 11);
  rect(ctx, WATER[2], cx - w / 2 + 2, top + 1, w - 4, 8);
  for (let i = 0; i < 8; i++) {
    const x = cx - w / 2 + 4 + ((i * 13 + Math.floor(t * 20)) % (w - 8));
    rect(ctx, WATER[0], x, top + 2 + (i % 3) * 2, 3, 1);
  }
}

/** Spray bouncing off whatever the water lands on. */
export function splash(ctx, cx, y, spread, t) {
  for (let i = 0; i < 12; i++) {
    const k = (t * 2.2 + hash(i)) % 1;
    const side = i % 2 ? 1 : -1;
    const x = cx + side * (spread * 0.3 + k * spread * (0.5 + hash(i + 3)));
    const yy = y - Math.sin(k * Math.PI) * (6 + hash(i + 8) * 6);
    rect(ctx, i % 3 ? WATER[1] : WATER[0], x, yy, 1 + (i % 2), 1);
  }
}

// ── Striking log ──────────────────────────────────────────────────

/** A wooden post planted at (x, groundY), tilted by `angle` about its base. */
export function strikingLog(ctx, x, groundY, angle = 0, height = 38) {
  const w = 12;
  ctx.save();
  ctx.translate(Math.round(x), groundY);
  ctx.rotate(angle);
  rect(ctx, INK, -w / 2 - 1, -height - 1, w + 2, height + 1);
  rect(ctx, WOOD.mid, -w / 2, -height, w, height);
  rect(ctx, WOOD.light, -w / 2, -height, 3, height);
  rect(ctx, WOOD.dark, w / 2 - 3, -height, 3, height);
  for (let y = -height + 6; y < -2; y += 7) rect(ctx, WOOD.deep, -w / 2 + 3 + (y % 3), y, 4, 1);
  // cut top with rings
  rect(ctx, WOOD.light, -w / 2, -height - 3, w, 3);
  rect(ctx, WOOD.mid, -w / 2 + 3, -height - 2, w - 6, 1);
  // straw wrap where it gets hit
  rect(ctx, '#ffcd75', -w / 2, -height * 0.62, w, 5);
  rect(ctx, '#ef7d57', -w / 2, -height * 0.62 + 2, w, 1);
  ctx.restore();
  // dirt mound
  rect(ctx, '#8a5a36', x - w / 2 - 4, groundY - 2, w + 8, 3);
}

export function woodChips(x, y, dir, count = 6) {
  const chips = Array.from({ length: count }, (_, i) => ({ vx: (hash(i + x) * 30 + 10) * dir, vy: -(hash(i + 40) * 30 + 20) }));
  return (ctx, p, age) => {
    ctx.globalAlpha = 1 - p;
    chips.forEach((c, i) => rect(ctx, i % 2 ? WOOD.light : WOOD.mid, x + c.vx * age, y + c.vy * age + 90 * age * age, 2, 1));
  };
}

// ── Punch glove machine ───────────────────────────────────────────

/** The machine stands at (x, groundY); the glove reaches `reach` pixels to the left. */
export function punchMachine(ctx, x, groundY, reach) {
  const armY = groundY - 24;
  // spring arm
  const coils = Math.max(3, Math.round(reach / 5));
  ctx.fillStyle = STONE[1];
  for (let i = 0; i < coils; i++) {
    const cx = x - 2 - (i * reach) / coils;
    rect(ctx, i % 2 ? STONE[1] : STONE[2], cx - reach / coils, armY + (i % 2 ? -3 : 1), reach / coils + 1, 2);
    rect(ctx, STONE[2], cx - reach / coils, armY - 3, 1, 6);
  }
  // glove
  const gx = x - reach - 14;
  rect(ctx, INK, gx - 1, armY - 7, 14, 14);
  rect(ctx, '#b13e53', gx, armY - 6, 12, 12);
  rect(ctx, '#ef7d57', gx + 1, armY - 5, 5, 3);
  rect(ctx, '#5d275d', gx, armY + 3, 12, 3);
  rect(ctx, '#f4f4f4', gx + 10, armY - 5, 3, 10); // cuff
  // housing on a post
  rect(ctx, INK, x - 1, armY - 11, 22, 21);
  rect(ctx, STONE[2], x, armY - 10, 20, 19);
  rect(ctx, STONE[1], x, armY - 10, 20, 3);
  rect(ctx, '#ffcd75', x + 3, armY - 5, 3, 3);
  rect(ctx, '#b13e53', x + 9, armY - 5, 3, 3);
  rect(ctx, STONE[3], x + 3, armY + 2, 14, 2);
  rect(ctx, INK, x + 7, armY + 10, 6, groundY - armY - 10);
  rect(ctx, STONE[3], x + 3, groundY - 3, 14, 3);
}

/** A flash of blue shield pixels in front of a blocking pet. */
export function blockShield(x, y, dir, h) {
  return (ctx, p) => {
    ctx.globalAlpha = 1 - p;
    for (let i = -h / 2; i <= h / 2; i += 2) {
      const bulge = Math.round(Math.cos((i / h) * Math.PI) * 4);
      rect(ctx, i % 4 === 0 ? '#73eff7' : '#41a6f6', x + bulge * dir, y + i, 2, 2);
    }
  };
}

// ── Running track ─────────────────────────────────────────────────

export function runningTrack(ctx, w, top, bottom) {
  rect(ctx, '#b13e53', 0, top, w, bottom - top);
  rect(ctx, '#f4f4f4', 0, top, w, 1);
  rect(ctx, '#f4f4f4', 0, bottom - 2, w, 1);
  for (let i = 0; i < 30; i++) rect(ctx, '#5d275d', Math.floor(hash(i + 3) * w), top + 2 + Math.floor(hash(i + 9) * (bottom - top - 5)), 1, 1);
  // start / turn markers at both ends
  for (const x of [4, w - 6]) {
    for (let y = top + 2; y < bottom - 3; y += 4) rect(ctx, '#f4f4f4', x, y, 2, 2);
  }
}

export function dustPuff(x, y, dir) {
  return (ctx, p) => {
    ctx.globalAlpha = 0.8 * (1 - p);
    const r = 1 + p * 4;
    rect(ctx, '#94b0c2', x - dir * p * 8 - r, y - r, r * 2, r);
    rect(ctx, '#f4f4f4', x - dir * p * 12, y - r - 1, 2, 1);
  };
}

// ── Classroom ─────────────────────────────────────────────────────

export function classroom(ctx, w, h, groundY) {
  rect(ctx, '#ffcd75', 0, 0, w, groundY - 14);
  rect(ctx, '#ef7d57', 0, groundY - 14, w, 2);
  rect(ctx, WOOD.mid, 0, groundY - 12, w, h);
  for (let y = groundY - 8; y < h; y += 5) rect(ctx, WOOD.dark, 0, y, w, 1);
  for (let y = groundY - 12, row = 0; y < h; y += 5, row++) {
    for (let x = (row * 17) % 30; x < w; x += 30) rect(ctx, WOOD.dark, x, y, 1, 5);
  }
  // chalkboard with lessons
  const bx = 18;
  const bw = w - 36;
  rect(ctx, WOOD.dark, bx - 3, 5, bw + 6, 40);
  rect(ctx, '#257179', bx, 8, bw, 34);
  rect(ctx, WOOD.light, bx - 3, 45, bw + 6, 2);
  ctx.fillStyle = '#f4f4f4';
  const scribble = [[6, 13, 14], [24, 13, 6], [34, 13, 10], [6, 20, 22], [32, 20, 4], [6, 27, 10], [20, 27, 16]];
  for (const [x, y, len] of scribble) rect(ctx, '#f4f4f4', bx + x, y, len, 1);
  // a little ABC and 1+1=2
  const glyphs = { A: ['.#.', '#.#', '###', '#.#'], B: ['##.', '###', '#.#', '##.'], C: ['.##', '#..', '#..', '.##'], 1: ['#', '#', '#', '#'], '+': ['...', '.#.', '###', '.#.'], '=': ['...', '###', '...', '###'], 2: ['##.', '..#', '.#.', '###'] };
  let cx = bx + bw - 44;
  for (const ch of 'ABC 1+1=2') {
    if (ch === ' ') {
      cx += 3;
      continue;
    }
    glyphs[ch].forEach((row, gy) => [...row].forEach((c, gx) => c === '#' && rect(ctx, '#f4f4f4', cx + gx, 12 + gy, 1, 1)));
    cx += glyphs[ch][0].length + 1;
  }
  // chalk tray pieces
  rect(ctx, '#f4f4f4', bx + 8, 44, 3, 1);
  rect(ctx, '#ffcd75', bx + 14, 44, 3, 1);
}

/** A school desk centred on cx, drawn in front of the pet; `page` 0..1 flips the book. */
export function desk(ctx, cx, groundY, width, page = 0, height = 20) {
  const top = groundY - height;
  const x = cx - width / 2;
  // book open on the desk
  const bw = 20;
  rect(ctx, INK, cx - bw / 2 - 1, top - 5, bw + 2, 5);
  rect(ctx, '#f4f4f4', cx - bw / 2, top - 4, bw / 2 - 1, 4);
  rect(ctx, '#f4f4f4', cx + 1, top - 4, bw / 2 - 1, 4);
  rect(ctx, '#94b0c2', cx - bw / 2 + 2, top - 3, bw / 2 - 5, 1);
  rect(ctx, '#94b0c2', cx + 3, top - 3, bw / 2 - 5, 1);
  rect(ctx, '#b13e53', cx - 1, top - 5, 2, 5);
  if (page > 0 && page < 1) {
    // a page lifting over the spine
    const lift = Math.sin(page * Math.PI) * 6;
    const px = cx + Math.cos(page * Math.PI) * (bw / 2 - 2);
    rect(ctx, '#f4f4f4', Math.min(cx, px), top - 5 - lift, Math.abs(px - cx) + 1, 2);
  }
  // desk top and body
  rect(ctx, INK, x - 1, top - 1, width + 2, 5);
  rect(ctx, WOOD.light, x, top, width, 3);
  rect(ctx, INK, x + 3, top + 3, width - 6, groundY - top - 3);
  const body = Math.max(4, height - 9);
  rect(ctx, WOOD.mid, x + 4, top + 3, width - 8, body);
  rect(ctx, WOOD.dark, x + 4, top + 1 + body, width - 8, 2);
  rect(ctx, WOOD.deep, cx - 4, top + 2 + body / 2, 8, 2); // drawer handle
  rect(ctx, WOOD.dark, x + 4, top + 3 + body, 3, groundY - top - 3 - body);
  rect(ctx, WOOD.dark, x + width - 7, top + 3 + body, 3, groundY - top - 3 - body);
}

/** A glowing lightbulb (bright) or a dim one, floating at (x, y). */
export function lightbulb(x, y, bright) {
  return (ctx, p, age) => {
    ctx.globalAlpha = p < 0.8 ? 1 : 1 - (p - 0.8) / 0.2;
    const yy = y - Math.min(age, 0.3) * 20;
    const glass = bright ? '#ffcd75' : '#94b0c2';
    rect(ctx, INK, x - 4, yy - 1, 9, 9);
    rect(ctx, glass, x - 3, yy, 7, 7);
    rect(ctx, '#f4f4f4', x - 2, yy + 1, 2, 2);
    rect(ctx, '#566c86', x - 2, yy + 8, 5, 3);
    rect(ctx, INK, x - 1, yy + 11, 3, 1);
    if (bright && Math.floor(age * 8) % 2 === 0) {
      for (const [dx, dy, w, h] of [[-8, 3, 3, 1], [7, 3, 3, 1], [0, -5, 1, 3], [-6, -3, 2, 1], [6, -3, 2, 1]]) rect(ctx, '#ffcd75', x + dx, yy + dy, w, h);
    }
  };
}

/** A short burst of pixels at an impact point. */
export function impactBurst(x, y, { color = '#f4f4f4', size = 8 } = {}) {
  return (ctx, p) => {
    ctx.globalAlpha = 1 - p;
    const r = size * (0.4 + p);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      rect(ctx, i % 2 ? color : '#ffcd75', x + Math.cos(a) * r, y + Math.sin(a) * r, 2, 2);
    }
  };
}
