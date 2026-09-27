/**
 * An animated pixel canvas holding one or more pet "actors".
 * Actor x/y is the bottom-centre (feet) in stage pixels.
 * Animations: 'attack' (lunge), 'hurt' (flash + shake), 'hop', 'dodge', and a persistent faint.
 * Custom motions (see animate) and free-form effects (see effect) power battle moves.
 */
import { SPRITES } from '../../sprites/animals.js';
import { GLYPHS } from '../../sprites/fx.js';
import { BACKGROUNDS } from '../../sprites/backgrounds.js';
import { drawSprite, drawGlyph, spriteSize } from '../../sprites/renderer.js';

// Built-in animations: motion(p, actor) -> offsets, with p going 0 → 1.
const ANIMS = {
  attack: { duration: 0.35, motion: (p, a) => ({ dx: Math.round(Math.sin(p * Math.PI) * 10) * a.scale * a.dir }) },
  hop: { duration: 0.45, motion: (p, a) => ({ dy: -Math.round(Math.sin(p * Math.PI) * 10) * a.scale }) },
  hurt: {
    duration: 0.45,
    motion: (p, a) => ({ variant: Math.floor(p * 8) % 2 === 0 ? 'flash' : 'normal', dx: (Math.floor(p * 12) % 2 ? 2 : -2) * a.scale }),
  },
  dodge: {
    duration: 0.4,
    motion: (p, a) => ({ dx: -Math.round(Math.sin(p * Math.PI) * 16) * a.scale * a.dir, dy: -Math.round(Math.sin(p * Math.PI) * 6) * a.scale }),
  },
};
const TRAIL_LENGTH = 4;
// fliers (sprite.hover) float above the ground; they land to sleep or when fainted
const hoverOf = (a) => (a.fainted || a.sleeping ? 0 : (SPRITES[a.species].hover ?? 0) * a.scale);
const PARTICLE_LIFE = 1.3;

// One shared animation loop for every stage on screen.
const stages = new Set();
let rafId = 0;
function loop(ms) {
  for (const stage of stages) stage.render(ms / 1000);
  rafId = stages.size ? requestAnimationFrame(loop) : 0;
}

export class PetStage {
  constructor({ width, height, background = null, className = '', label = 'Pet scene' }) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.className = `stage ${className}`.trim();
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', label);
    this.ctx = this.canvas.getContext('2d');
    this.background = background;
    this.actors = new Map();
    this.particles = [];
    this.effects = [];
    this.quake = null;
    this.now = performance.now() / 1000;
    stages.add(this);
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  addActor(id, { species, x, y, scale = 1, flip = false }) {
    this.actors.set(id, {
      id, species, x, y, scale, flip, dir: flip ? -1 : 1,
      sleeping: false, fainted: false, hidden: false, anim: null, trail: [], phase: Math.random() * 6, nextZ: 0,
    });
  }

  setSleeping(id, sleeping) {
    const a = this.actors.get(id);
    if (a) a.sleeping = sleeping;
  }

  setFainted(id, fainted) {
    const a = this.actors.get(id);
    if (a) a.fainted = fainted;
  }

  /** Semi-transparent, for stealth. */
  setHidden(id, hidden) {
    const a = this.actors.get(id);
    if (a) a.hidden = hidden;
  }

  play(id, name) {
    if (ANIMS[name]) this.animate(id, ANIMS[name].motion, ANIMS[name].duration);
  }

  /**
   * Runs a custom motion on an actor. motion(p, actor) returns any of
   * { dx, dy, angle, sx, sy, alpha, variant, trail }.
   */
  animate(id, motion, duration, { delay = 0 } = {}) {
    const a = this.actors.get(id);
    if (a) a.anim = { motion, duration, start: this.now + delay };
  }

  /** Where an actor stands: feet (x, y), body centre (cx, cy), size and facing. */
  actorBox(id) {
    const a = this.actors.get(id);
    if (!a) return null;
    const { w, h } = spriteSize(SPRITES[a.species]);
    const lift = hoverOf(a);
    return { x: a.x, y: a.y, cx: a.x, cy: a.y - lift - (h * a.scale) / 2, w: w * a.scale, h: h * a.scale, dir: a.dir, scale: a.scale };
  }

  /** Draws draw(ctx, p, age) every frame for `duration` seconds, on top of the actors. */
  effect(draw, duration, { delay = 0 } = {}) {
    this.effects.push({ draw, duration, start: this.now + delay });
  }

  shake(power = 2, duration = 0.3, { delay = 0 } = {}) {
    this.quake = { power, duration, start: this.now + delay };
  }

  emote(id, glyphName, count = 1) {
    const a = this.actors.get(id);
    const glyph = GLYPHS[glyphName];
    if (!a || !glyph) return;
    const { w, h } = spriteSize(SPRITES[a.species]);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        glyph,
        scale: Math.max(1, a.scale - 1) || 1,
        x: a.x + (Math.random() - 0.5) * w * a.scale * 0.6,
        y: a.y - hoverOf(a) - h * a.scale - 2,
        start: this.now + i * 0.18,
        drift: (Math.random() - 0.5) * 6,
      });
    }
  }

  destroy() {
    stages.delete(this);
  }

  render(t) {
    this.now = t;
    const { ctx, canvas } = this;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    const q = this.quake;
    if (q && t >= q.start) {
      const k = 1 - (t - q.start) / q.duration;
      if (k <= 0) this.quake = null;
      else ctx.translate(Math.round((Math.random() - 0.5) * 2 * q.power * k), Math.round((Math.random() - 0.5) * 2 * q.power * k));
    }
    if (this.background) BACKGROUNDS[this.background](ctx, canvas.width, canvas.height, t);
    // The actor that is moving is drawn last, so an attacker passes in front of its target.
    const order = [...this.actors.values()].sort((a, b) => Number(Boolean(a.anim)) - Number(Boolean(b.anim)));
    for (const actor of order) this.drawActor(actor, t);
    this.drawEffects(t);
    this.drawParticles(t);
    ctx.restore();
  }

  drawEffects(t) {
    this.effects = this.effects.filter((e) => t - e.start < e.duration);
    for (const e of this.effects) {
      const age = t - e.start;
      if (age < 0) continue;
      this.ctx.save();
      e.draw(this.ctx, age / e.duration, age);
      this.ctx.restore();
    }
  }

  drawActor(a, t) {
    const sprite = SPRITES[a.species];
    const { w, h } = spriteSize(sprite);
    const s = a.scale;
    let dx = 0;
    let dy = -hoverOf(a);
    let variant = 'normal';
    let pose = {};

    if (a.sleeping) {
      variant = 'blink';
      dy += Math.sin(t * 1.2 + a.phase) > 0.2 ? s : 0;
      if (t > a.nextZ) {
        a.nextZ = t + 1.1;
        this.emote(a.id, 'z');
      }
    } else if (!a.fainted) {
      // breathing; fliers bob a little more, like wing beats
      dy += hoverOf(a) ? Math.round(Math.sin(t * 4 + a.phase) * 2) * s : Math.sin(t * 2.6 + a.phase) > 0.35 ? s : 0;
      if ((t + a.phase) % 3.4 < 0.14) variant = 'blink';
    }

    if (a.anim && t >= a.anim.start) {
      const p = (t - a.anim.start) / a.anim.duration;
      if (p >= 1) a.anim = null;
      else {
        pose = a.anim.motion(p, a) || {};
        dx = pose.dx ?? 0;
        dy += pose.dy ?? 0;
        variant = pose.variant ?? variant;
      }
    }

    // shadow stays on the ground and shrinks as the actor leaves it
    const lift = Math.min(1, Math.max(0, -dy) / 40);
    const shadowW = Math.round(w * s * 0.7 * (1 - lift * 0.6));
    this.ctx.fillStyle = `rgba(11, 12, 20, ${0.35 * (1 - lift * 0.5)})`;
    this.ctx.fillRect(Math.round(a.x + dx - shadowW / 2), a.y - s, shadowW, 2 * s);

    let alpha = a.fainted ? 0.35 : a.hidden ? 0.3 + 0.08 * Math.sin(t * 6) : 1;
    if (pose.alpha != null) alpha *= pose.alpha;
    const faintDrop = a.fainted ? 2 * s : 0;
    const drawX = a.x - (w * s) / 2 + dx;
    const drawY = a.y - h * s + dy + faintDrop;
    const opts = { scale: s, flip: a.flip, alpha, angle: (pose.angle ?? 0) * a.dir, sx: pose.sx ?? 1, sy: pose.sy ?? 1 };

    // afterimages for fast moves
    if (pose.trail) {
      a.trail.forEach((g, i) => drawSprite(this.ctx, sprite, g.x, g.y, { ...opts, angle: g.angle, alpha: alpha * 0.12 * (i + 1) }));
      a.trail.push({ x: drawX, y: drawY, angle: opts.angle });
      if (a.trail.length > TRAIL_LENGTH) a.trail.shift();
    } else if (a.trail.length) a.trail = [];

    drawSprite(this.ctx, sprite, drawX, drawY, { ...opts, variant });
  }

  drawParticles(t) {
    this.particles = this.particles.filter((p) => t - p.start < PARTICLE_LIFE);
    for (const p of this.particles) {
      const age = t - p.start;
      if (age < 0) continue;
      const k = age / PARTICLE_LIFE;
      drawGlyph(this.ctx, p.glyph, p.x + p.drift * k, p.y - age * 14, { scale: p.scale, alpha: 1 - k * k });
    }
  }
}
