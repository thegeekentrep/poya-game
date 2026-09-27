/**
 * Pixel-art props for the care mini-games: brushing (groom) and the feather wand (play).
 * Behaviour lives in ui/components/groomModal.js and playModal.js.
 */
const INK = '#1a1c2c';

function rect(ctx, color, x, y, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

// ── Brushing ──────────────────────────────────────────────────────

// dirt patterns around a spot's centre: [dx, dy] offsets, densest first
const MUD = [[0, 0], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, 1], [0, -1], [2, 1], [-2, 0], [1, -1], [2, 0], [-1, 2]];
const TANGLE = [[0, 0], [1, -1], [2, 0], [-1, 1], [-2, 0], [0, 1], [3, 1], [-3, 1]];

/** A clump of mud or a tangle; `dirt` 0..1 is how much is left. */
export function dirtSpot(ctx, x, y, kind, dirt) {
  const pts = kind === 'tangle' ? TANGLE : MUD;
  const n = Math.ceil(pts.length * dirt);
  const colors = kind === 'tangle' ? ['#333c57', '#566c86'] : ['#6e4527', '#4e2e23', '#8a5a36'];
  pts.slice(0, n).forEach(([dx, dy], i) => rect(ctx, colors[i % colors.length], x + dx, y + dy));
}

/** The brush, bristles at (x, y). `tilt` flips it as it moves. */
export function brush(ctx, x, y, tilt = 0) {
  const t = tilt > 0 ? 1 : -1;
  // handle
  for (let i = 0; i < 9; i++) rect(ctx, i < 2 ? INK : '#a2653c', x + 4 * t + i * t, y - 5 - Math.floor(i / 2), 2, 2);
  // head and bristles
  rect(ctx, INK, x - 5, y - 5, 11, 4);
  rect(ctx, '#b13e53', x - 4, y - 4, 9, 2);
  rect(ctx, '#ef7d57', x - 4, y - 4, 9, 1);
  for (let i = -4; i <= 4; i += 2) rect(ctx, '#f4f4f4', x + i, y - 1, 1, 2);
}

/** A soap bubble: size 1 (a speck), 2 (small ring) or 3 (big ring with a shine). */
function bubble(ctx, x, y, size) {
  if (size === 1) return rect(ctx, '#f4f4f4', x, y);
  const r = size === 2 ? 1 : 2;
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    rect(ctx, '#73eff7', x + Math.round(Math.cos(ang) * r), y + Math.round(Math.sin(ang) * r));
  }
  rect(ctx, '#f4f4f4', x - r + 1, y - r + (size === 3 ? 1 : 0)); // shine
}

/** Soap bubbles floating up from a scrubbed spot; `count` scales with how hard you scrub. */
export function suds(x, y, count = 8) {
  const bits = Array.from({ length: count }, () => ({
    dx: (Math.random() - 0.5) * 16,
    vy: 8 + Math.random() * 18,
    wobble: Math.random() * 6,
    size: Math.random() < 0.3 ? 3 : Math.random() < 0.6 ? 2 : 1,
  }));
  return (ctx, p, age) => {
    ctx.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
    for (const b of bits) {
      // big bubbles pop partway up
      if (b.size === 3 && p > 0.6 + b.wobble / 20) continue;
      bubble(ctx, x + b.dx + Math.sin(age * 6 + b.wobble) * 2, y - b.vy * age, b.size);
    }
  };
}

/** Lather clinging to the fur where you scrub; `amount` 0..1. */
export function foam(ctx, x, y, amount, seed) {
  const n = Math.round(amount * 14);
  for (let i = 0; i < n; i++) {
    const a = seed + i * 2.4;
    const d = 1 + (i % 4) * 1.3;
    const px = x + Math.cos(a) * d * 1.4;
    const py = y + Math.sin(a) * d * 0.8;
    if (i % 5 === 4) bubble(ctx, Math.round(px), Math.round(py), 2);
    else rect(ctx, i % 3 ? '#f4f4f4' : '#94b0c2', px, py, 2, 1);
  }
}

// ── Feather wand ──────────────────────────────────────────────────

/** A feather lure on a string hanging from (anchorX, 0) down to (x, y). */
export function featherWand(ctx, anchorX, x, y, t) {
  // the string sags a little between the stick and the lure
  const steps = Math.max(4, Math.ceil(Math.hypot(x - anchorX, y)));
  for (let i = 0; i <= steps; i += 2) {
    const k = i / steps;
    const sag = Math.sin(k * Math.PI) * 4;
    rect(ctx, '#f4f4f4', anchorX + (x - anchorX) * k + sag * 0.3, y * k + sag * (1 - k) * 0.5);
  }
  // the lure: a bead and three flicking feathers
  const flick = Math.round(Math.sin(t * 12));
  rect(ctx, INK, x - 2, y - 1, 5, 4);
  rect(ctx, '#ffcd75', x - 1, y, 3, 2);
  const feathers = [['#b13e53', -3, 1], ['#73eff7', 0, 1], ['#a7f070', 3, 1]];
  for (const [color, dx, w] of feathers) {
    for (let i = 0; i < 6; i++) rect(ctx, color, x + dx + (i > 2 ? flick * Math.sign(dx || 1) : 0), y + 3 + i, w + (i > 1 && i < 5 ? 1 : 0), 1);
  }
}

/** The stick the wand hangs from, poking in from the top edge. */
export function wandStick(ctx, x) {
  rect(ctx, INK, x - 2, 0, 5, 4);
  rect(ctx, '#a2653c', x - 1, 0, 3, 3);
}
