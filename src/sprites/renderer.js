/**
 * Low-level pixel drawing. Sprites are rasterised once per variant
 * (normal / blink / flash) into offscreen canvases and cached.
 */
const cache = new Map();

export const spriteSize = (sprite) => ({ w: sprite.rows[0].length, h: sprite.rows.length });

function rasterise(sprite, variant) {
  const key = `${sprite.id}:${variant}`;
  if (cache.has(key)) return cache.get(key);

  const { w, h } = spriteSize(sprite);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  sprite.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      let color = sprite.palette[ch];
      if (variant === 'flash') color = '#f4f4f4';
      else if (variant === 'blink' && ch === 'e') color = sprite.palette[sprite.blink];
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  cache.set(key, canvas);
  return canvas;
}

/** Draws a sprite with its top-left at (x, y). */
export function drawSprite(ctx, sprite, x, y, { scale = 1, flip = false, variant = 'normal', alpha = 1 } = {}) {
  const img = rasterise(sprite, variant);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  if (flip) {
    ctx.translate(Math.round(x) + w, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, w, h);
  } else {
    ctx.drawImage(img, Math.round(x), Math.round(y), w, h);
  }
  ctx.restore();
}

/** Draws a one-colour glyph (see fx.js) with its top-left at (x, y). */
export function drawGlyph(ctx, glyph, x, y, { scale = 1, alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = glyph.color;
  glyph.rows.forEach((row, gy) => {
    for (let gx = 0; gx < row.length; gx++) {
      if (row[gx] === '#') ctx.fillRect(Math.round(x + gx * scale), Math.round(y + gy * scale), scale, scale);
    }
  });
  ctx.restore();
}
