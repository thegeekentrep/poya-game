/**
 * Pixel-art battle effects. Each factory returns draw(ctx, p) for PetStage.effect,
 * where p runs 0 → 1 over the effect's life. Coordinates are stage pixels.
 * `dir` is +1 when the attacker faces right, -1 when it faces left.
 */
const px = (ctx, x, y, size = 1) => ctx.fillRect(Math.round(x), Math.round(y), size, size);
const ease = (p) => 1 - (1 - p) ** 3;

/** A pixel line from (x0, y0) to (x1, y1), drawn only up to fraction `upTo`. */
function line(ctx, x0, y0, x1, y1, size = 2, upTo = 1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= steps * upTo; i++) px(ctx, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, size);
}

/** Draws in for the first `drawIn` of its life, holds, then fades. */
function reveal(ctx, p, drawIn = 0.3) {
  ctx.globalAlpha = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
  return Math.min(1, p / drawIn);
}

/** Parallel diagonal claw marks raked across (x, y). */
export const clawMarks = (x, y, dir, { count = 3, len = 22, color = '#f4f4f4', gap = 6, down = true } = {}) =>
  (ctx, p) => {
    const upTo = reveal(ctx, p);
    ctx.fillStyle = color;
    for (let i = 0; i < count; i++) {
      const ox = (i - (count - 1) / 2) * gap * dir;
      const x0 = x + ox - (len / 2) * dir * 0.6;
      const y0 = down ? y - len / 2 : y + len / 2;
      line(ctx, x0, y0, x0 + len * 0.6 * dir, down ? y + len / 2 : y - len / 2, 2, Math.max(0, upTo * 1.4 - i * 0.2));
    }
  };

/** A curved slash arc around (x, y). */
export const slashArc = (x, y, dir, { r = 18, from = -1.2, to = 1.1, color = '#f4f4f4', size = 2 } = {}) =>
  (ctx, p) => {
    const upTo = reveal(ctx, p, 0.25);
    ctx.fillStyle = color;
    const steps = Math.ceil(r * Math.abs(to - from));
    for (let i = 0; i <= steps * upTo; i++) {
      const a = from + ((to - from) * i) / steps;
      const thick = i > steps * 0.2 && i < steps * 0.8 ? size + 1 : size;
      px(ctx, x + Math.sin(a) * r * dir, y - Math.cos(a) * r, thick);
    }
  };

/**
 * A side-on mouth hinged on the attacker's side: it gapes open just before `snap`
 * seconds, snaps shut then (time it to the blow landing), clamps on with a tremble,
 * then fades. `at` is where the teeth meet: { x, y }, or at(age) -> { x, y } to ride
 * along with the biter's head. The mouth opens toward `dir`.
 */
export const jaws = (at, dir, { snap = 0.3, len = 16, open = 7, color = '#f4f4f4', gum = '#b13e53' } = {}) =>
  (ctx, p, age) => {
    const gape = 0.18; // how long the mouth is visibly opening
    if (age < snap - gape) return;
    const { x, y } = typeof at === 'function' ? at(age) : at;
    const shut = age >= snap;
    const half = shut ? 0 : open * Math.sin(((age - (snap - gape)) / gape) * Math.PI * 0.85);
    const hold = age - snap;
    ctx.globalAlpha = !shut || hold < 0.3 ? 1 : Math.max(0, 1 - (hold - 0.3) / 0.2);
    const jitter = shut && hold < 0.3 ? (Math.floor(hold * 30) % 2 ? 1 : -1) : 0;
    const hx = x - (dir * len) / 2;
    for (let i = 0; i <= len; i++) {
      const u = i / len;
      const cx = Math.round(hx + dir * i);
      const gap = Math.round(half * u);
      const top = Math.round(y) - gap + jitter;
      const bottom = Math.round(y) + gap + jitter;
      if (gap > 1) {
        ctx.fillStyle = '#1a1c2c'; // inside of the mouth
        ctx.fillRect(cx, top - 1, 1, bottom - top + 2);
      }
      ctx.fillStyle = gum;
      ctx.fillRect(cx, top - 5, 1, 2);
      ctx.fillRect(cx, bottom + 3, 1, 2);
      ctx.fillStyle = color;
      // interlocking teeth: upper fangs every 4px, lower ones between them
      const upper = [3, 2, 0, 1][i % 4];
      const lower = [0, 1, 3, 1][i % 4];
      if (upper) ctx.fillRect(cx, top - 3, 1, upper);
      if (lower) ctx.fillRect(cx, bottom + 3 - lower, 1, lower);
    }
  };

/**
 * A rock heaved up off the ground at `ground` until it is overhead at (x0, y0) by `lift`
 * seconds, then lobbed in an arc to land on (x1, y1) at `land`.
 */
export const boulder = (x0, y0, x1, y1, { ground = y0, lift = 0.25, land = 0.5, color = '#566c86', shine = '#94b0c2', edge = '#333c57', r = 8 } = {}) =>
  (ctx, p, age) => {
    const q = Math.min(1, Math.max(0, (age - lift) / (land - lift)));
    const heave = ease(Math.min(1, age / (lift * 0.7)));
    const x = x0 + (x1 - x0) * q;
    const y = q > 0 ? y0 + (y1 - y0) * q - Math.sin(q * Math.PI) * 26 : ground + (y0 - ground) * heave;
    const disc = (rad, fill) => {
      ctx.fillStyle = fill;
      for (let dy = -rad; dy <= rad; dy++) {
        const w = Math.round(Math.sqrt(rad * rad - dy * dy));
        ctx.fillRect(Math.round(x - w), Math.round(y + dy), w * 2, 1);
      }
    };
    disc(r, edge);
    disc(r - 1, color);
    // a highlight and a crack that tumble as it flies
    const spin = Math.floor(q * 8) % 4;
    const [sx, sy] = [[-3, -3], [1, -3], [1, 1], [-3, 1]][spin];
    ctx.fillStyle = shine;
    ctx.fillRect(Math.round(x + sx), Math.round(y + sy), 3, 2);
    ctx.fillStyle = edge;
    ctx.fillRect(Math.round(x - sx), Math.round(y - sy), 2, 1);
  };

/** Star-shaped impact burst. */
export const burst = (x, y, { color = '#ffcd75', rays = 8, r = 14, size = 2 } = {}) =>
  (ctx, p) => {
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = color;
    const inner = ease(p) * r * 0.6;
    const outer = inner + r * 0.5 * (1 - p) + 3;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + 0.3;
      line(ctx, x + Math.cos(a) * inner, y + Math.sin(a) * inner, x + Math.cos(a) * outer, y + Math.sin(a) * outer, size);
    }
    if (p < 0.2) px(ctx, x - 3, y - 3, 6);
  };

/** Expanding ring; `squash` < 1 makes a flat ellipse on the ground. */
export const ring = (x, y, { color = '#f4f4f4', r = 20, squash = 1, size = 2 } = {}) =>
  (ctx, p) => {
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = color;
    const rad = 2 + ease(p) * r;
    const steps = Math.ceil(rad * 3);
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      px(ctx, x + Math.cos(a) * rad, y + Math.sin(a) * rad * squash, size);
    }
  };

/** Puffs of dust kicked up from the ground at (x, y). */
export const dust = (x, y, { color = '#7a4a32', puffs = 6, spread = 22 } = {}) => {
  const seeds = Array.from({ length: puffs }, (_, i) => ({ vx: ((i / (puffs - 1)) * 2 - 1) * spread, vy: 4 + Math.random() * 8, size: 2 + Math.floor(Math.random() * 3) }));
  return (ctx, p) => {
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = color;
    const k = ease(p);
    for (const s of seeds) px(ctx, x + s.vx * k, y - s.vy * k - 1, s.size);
  };
};

/** A shockwave rolling along the ground from x0 to x1. */
export const groundWave = (x0, x1, y, { color = '#7a4a32' } = {}) =>
  (ctx, p) => {
    ctx.fillStyle = color;
    const x = x0 + (x1 - x0) * p;
    ctx.globalAlpha = p < 0.8 ? 1 : (1 - p) / 0.2;
    for (let i = 0; i < 5; i++) {
      const h = [3, 6, 9, 6, 3][i];
      ctx.fillRect(Math.round(x + (i - 2) * 3), y - h, 3, h);
    }
    ctx.globalAlpha *= 0.5;
    for (let i = 1; i < 5; i++) ctx.fillRect(Math.round(x - (x1 - x0 > 0 ? 1 : -1) * i * 6), y - 2, 3, 2);
  };

/** Sound-wave arcs ")))" travelling from x0 to x1. */
export const soundWaves = (x0, x1, y, dir, { color = '#73eff7', waves = 3 } = {}) =>
  (ctx, p) => {
    ctx.fillStyle = color;
    for (let w = 0; w < waves; w++) {
      const q = p * 1.6 - w * 0.25;
      if (q < 0 || q > 1) continue;
      ctx.globalAlpha = 1 - q * 0.6;
      const x = x0 + (x1 - x0) * q;
      const r = 6 + q * 10;
      for (let a = -1; a <= 1; a += 0.12) px(ctx, x + Math.cos(a) * r * dir - r * dir, y + Math.sin(a) * r, 2);
    }
  };

/** Target reticle closing in on (x, y). */
export const reticle = (x, y, { color = '#b13e53', r = 20 } = {}) =>
  (ctx, p) => {
    ctx.globalAlpha = p < 0.7 ? (Math.floor(p * 14) % 2 ? 1 : 0.6) : (1 - p) / 0.3;
    ctx.fillStyle = color;
    const d = Math.round(r * (1 - ease(Math.min(1, p / 0.4))) + 8);
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      ctx.fillRect(x + sx * d - (sx > 0 ? 5 : 0), y + sy * d - (sy > 0 ? 1 : 0), 6, 2);
      ctx.fillRect(x + sx * d - (sx > 0 ? 1 : 0), y + sy * d - (sy > 0 ? 5 : 0), 2, 6);
    }
    ctx.fillRect(x - 1, y - 1, 2, 2);
  };

/** Squares rising and fading, e.g. dark smoke or healing sparks. */
export const rising = (x, y, { color = '#333c57', count = 10, spread = 26, height = 26, size = 3 } = {}) => {
  const seeds = Array.from({ length: count }, () => ({ ox: (Math.random() - 0.5) * spread, delay: Math.random() * 0.4, sway: Math.random() * 6 }));
  return (ctx, p) => {
    ctx.fillStyle = color;
    for (const s of seeds) {
      const q = (p - s.delay) / (1 - s.delay);
      if (q < 0) continue;
      ctx.globalAlpha = 1 - q;
      px(ctx, x + s.ox + Math.sin(q * 6) * s.sway * 0.3, y - q * height, size);
    }
  };
};

/** Droplets flung out and falling with gravity, e.g. blood. */
export const droplets = (x, y, dir, { color = '#b13e53', count = 7 } = {}) => {
  const seeds = Array.from({ length: count }, () => ({ vx: (0.3 + Math.random()) * 18 * dir, vy: -10 - Math.random() * 14 }));
  return (ctx, p) => {
    ctx.globalAlpha = 1 - p * p;
    ctx.fillStyle = color;
    for (const s of seeds) px(ctx, x + s.vx * p, y + s.vy * p + 40 * p * p, 2);
  };
};

/** Pinching lines squeezing inward on (x, y), for grabs. */
export const squeeze = (x, y, { color = '#ffcd75', r = 22 } = {}) =>
  (ctx, p) => {
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = color;
    const d = r * (1 - ease(p) * 0.6);
    for (const s of [-1, 1]) {
      for (let i = -1; i <= 1; i++) line(ctx, x + s * d, y + i * 7, x + s * (d + 6), y + i * 7 + i * 3, 2);
    }
  };

/** Full-stage flash for big hits. */
export const flash = (color = '#f4f4f4', strength = 0.5) =>
  (ctx, p) => {
    ctx.globalAlpha = strength * (1 - p);
    ctx.fillStyle = color;
    ctx.fillRect(-8, -8, ctx.canvas.width + 16, ctx.canvas.height + 16);
  };
