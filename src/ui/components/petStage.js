/**
 * An animated pixel canvas holding one or more pet "actors".
 * Actor x/y is the bottom-centre (feet) in stage pixels.
 * Animations: 'attack' (lunge), 'hurt' (flash + shake), 'hop', and a persistent faint.
 */
import { SPRITES } from '../../sprites/animals.js';
import { GLYPHS } from '../../sprites/fx.js';
import { BACKGROUNDS } from '../../sprites/backgrounds.js';
import { drawSprite, drawGlyph, spriteSize } from '../../sprites/renderer.js';

const ANIM_DURATION = { attack: 0.35, hurt: 0.45, hop: 0.45 };
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
    this.now = performance.now() / 1000;
    stages.add(this);
    if (!rafId) rafId = requestAnimationFrame(loop);
  }

  addActor(id, { species, x, y, scale = 1, flip = false }) {
    this.actors.set(id, { id, species, x, y, scale, flip, sleeping: false, fainted: false, anim: null, phase: Math.random() * 6, nextZ: 0 });
  }

  setSleeping(id, sleeping) {
    const a = this.actors.get(id);
    if (a) a.sleeping = sleeping;
  }

  setFainted(id, fainted) {
    const a = this.actors.get(id);
    if (a) a.fainted = fainted;
  }

  play(id, name) {
    const a = this.actors.get(id);
    if (a && ANIM_DURATION[name]) a.anim = { name, start: this.now };
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
        y: a.y - h * a.scale - 2,
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
    if (this.background) BACKGROUNDS[this.background](ctx, canvas.width, canvas.height, t);
    for (const actor of this.actors.values()) this.drawActor(actor, t);
    this.drawParticles(t);
  }

  drawActor(a, t) {
    const sprite = SPRITES[a.species];
    const { w, h } = spriteSize(sprite);
    const s = a.scale;
    let dx = 0;
    let dy = 0;
    let variant = 'normal';

    if (a.sleeping) {
      variant = 'blink';
      dy = Math.sin(t * 1.2 + a.phase) > 0.2 ? s : 0;
      if (t > a.nextZ) {
        a.nextZ = t + 1.1;
        this.emote(a.id, 'z');
      }
    } else if (!a.fainted) {
      dy = Math.sin(t * 2.6 + a.phase) > 0.35 ? s : 0; // breathing
      if ((t + a.phase) % 3.4 < 0.14) variant = 'blink';
    }

    if (a.anim) {
      const p = (t - a.anim.start) / ANIM_DURATION[a.anim.name];
      if (p >= 1) a.anim = null;
      else if (a.anim.name === 'attack') dx = Math.round(Math.sin(p * Math.PI) * 10) * s * (a.flip ? -1 : 1) / 2;
      else if (a.anim.name === 'hop') dy = -Math.round(Math.sin(p * Math.PI) * 5) * s;
      else if (a.anim.name === 'hurt') {
        variant = Math.floor(p * 8) % 2 === 0 ? 'flash' : 'normal';
        dx = (Math.floor(p * 12) % 2 ? 1 : -1) * s;
      }
    }

    // shadow
    this.ctx.fillStyle = 'rgba(11, 12, 20, 0.35)';
    this.ctx.fillRect(Math.round(a.x - w * s * 0.35), a.y - s, Math.round(w * s * 0.7), 2 * s);

    const alpha = a.fainted ? 0.35 : 1;
    const faintDrop = a.fainted ? 2 * s : 0;
    drawSprite(this.ctx, sprite, a.x - (w * s) / 2 + dx, a.y - h * s + dy + faintDrop, { scale: s, flip: a.flip, variant, alpha });
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
