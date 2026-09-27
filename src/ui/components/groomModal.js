/**
 * Groom mini-game: drag the brush over the pet to scrub away mud and tangles.
 * The dirtier the pet, the more spots. Quality (share of dirt removed) scales
 * the hygiene gain in care/care.js.
 */
import { h } from '../dom.js';
import { openModal } from './modal.js';
import { PetStage } from './petStage.js';
import { createBar } from './statBar.js';
import { SPRITES } from '../../sprites/animals.js';
import { spriteSize } from '../../sprites/renderer.js';
import * as P from '../../sprites/careProps.js';
import { playSfx } from '../../audio/sfx.js';

const W = 192;
const H = 96;
const GROUND = 88;
const REACH = 7; // brush radius in stage pixels
const SCRUB = 0.045; // dirt removed per pixel of brush movement

/** Picks spot positions on the sprite's fur (not eyes, not too close together). */
function pickSpots(sprite, count) {
  const cells = [];
  sprite.rows.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && c !== 'e' && c !== 'i' && cells.push({ x, y })));
  const spots = [];
  for (let tries = 0; spots.length < count && tries < 400; tries++) {
    const c = cells[Math.floor(Math.random() * cells.length)];
    if (spots.every((s) => Math.hypot(s.x - c.x, s.y - c.y) > 8)) spots.push({ ...c, dirt: 1, foam: 0, seed: Math.random() * 6, kind: Math.random() < 0.35 ? 'tangle' : 'mud' });
  }
  return spots;
}

export function openGroomModal({ pet, onComplete }) {
  const sprite = SPRITES[pet.species];
  const { w } = spriteSize(sprite);
  const stage = new PetStage({ width: W, height: H, background: 'meadow', label: `Brushing ${pet.name}` });
  stage.addActor('pet', { species: pet.species, x: W / 2, y: GROUND });
  const box = stage.actorBox('pet');
  const left = box.x - w / 2;
  const top = box.cy - box.h / 2; // top of the sprite, including a flier's hover
  const spots = pickSpots(sprite, Math.max(4, Math.min(12, Math.round((100 - pet.needs.hygiene) / 8))));
  const total = spots.length;

  let brushAt = null; // { x, y } in stage pixels while the pointer is over the stage
  let scrubbing = false;
  let tilt = 1;
  let travelled = 0;
  let lastLove = 0;
  let lastFizz = 0;
  let lastFrame = null;
  let finished = false;

  const cleaned = () => spots.reduce((sum, s) => sum + (1 - s.dirt), 0) / total;

  stage.setLayers({
    front: (ctx, t) => {
      const dt = lastFrame == null ? 0 : Math.min(0.1, t - lastFrame);
      lastFrame = t;
      for (const s of spots) if (s.dirt > 0) P.dirtSpot(ctx, left + s.x, top + s.y, s.kind, s.dirt);
      for (const s of spots) {
        s.foam = Math.max(0, s.foam - dt * 0.25); // lather slowly melts away
        if (s.foam > 0) P.foam(ctx, left + s.x, top + s.y, s.foam, s.seed);
      }
      if (brushAt && !finished) P.brush(ctx, brushAt.x, brushAt.y + (scrubbing ? 1 : 0), tilt);
    },
  });

  const bar = createBar({ label: 'Clean', color: 'var(--c-cyan)' });
  const hint = h('p', { class: 'muted' }, 'Drag the brush over the mud and tangles.');
  const brushBtn = h('button', { class: 'btn', onclick: () => scrubDirtiest() }, 'Brush');
  const doneBtn = h('button', { class: 'btn btn-ghost', onclick: () => finish() }, 'Stop');
  const actions = h('div', { class: 'btn-row' }, brushBtn, doneBtn);
  const body = h('div', { class: 'training-sim care-game' }, h('h2', {}, `Brushing ${pet.name}`), h('div', { class: 'stage-frame' }, stage.canvas), bar.el, hint, actions);

  function updateBar() {
    bar.set(cleaned() * 100, 100, `${Math.round(cleaned() * 100)}%`);
  }

  /** Removes dirt near (x, y) in proportion to how far the brush moved. */
  function scrub(x, y, moved) {
    let hit = false;
    for (const s of spots) {
      if (s.dirt <= 0 || Math.hypot(left + s.x - x, top + s.y - y) > REACH) continue;
      s.dirt = Math.max(0, s.dirt - moved * SCRUB * (s.kind === 'tangle' ? 0.6 : 1)); // tangles take longer
      hit = true;
      s.foam = Math.min(1, s.foam + moved * 0.04);
      if (stage.now - (s.sudsAt || 0) > 0.08) {
        s.sudsAt = stage.now; // throttled: pointer events can fire 120 times a second
        stage.effect(P.suds(left + s.x, top + s.y, 4 + Math.round(s.foam * 6)), 1);
      }
      if (s.dirt === 0) {
        playSfx('pop');
        stage.effect(P.suds(left + s.x, top + s.y, 16), 1.2); // a big burst of bubbles
      }
    }
    if (!hit) return;
    travelled += moved;
    if (travelled > 60) {
      travelled = 0;
      playSfx('brush');
    }
    if (stage.now - lastFizz > 0.18) {
      lastFizz = stage.now;
      playSfx('bubbles');
    }
    // the pet leans into it now and then
    if (stage.now - lastLove > 1.8) {
      lastLove = stage.now;
      stage.emote('pet', 'heart');
      stage.animate('pet', (p) => ({ angle: -Math.sin(p * Math.PI) * 0.08, sy: 1 - Math.sin(p * Math.PI) * 0.04, variant: 'blink' }), 0.8);
    }
    updateBar();
    if (cleaned() >= 1) finish();
  }

  // keyboard / button: a few strokes on the dirtiest spot
  function scrubDirtiest() {
    const s = spots.filter((sp) => sp.dirt > 0).sort((a, b) => b.dirt - a.dirt)[0];
    if (!s) return;
    brushAt = { x: left + s.x, y: top + s.y };
    tilt = -tilt;
    scrub(brushAt.x, brushAt.y, 12);
  }

  const toStage = (e) => {
    const r = stage.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  stage.canvas.style.touchAction = 'none';
  stage.canvas.style.cursor = 'none';
  stage.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stage.canvas.setPointerCapture?.(e.pointerId);
    scrubbing = true;
    brushAt = toStage(e);
  });
  stage.canvas.addEventListener('pointermove', (e) => {
    const p = toStage(e);
    if (brushAt && scrubbing && !finished) {
      const moved = Math.hypot(p.x - brushAt.x, p.y - brushAt.y);
      if (Math.abs(p.x - brushAt.x) > 0.5) tilt = Math.sign(p.x - brushAt.x);
      scrub(p.x, p.y, Math.min(moved, 20));
    }
    brushAt = p;
  });
  const lift = () => (scrubbing = false);
  stage.canvas.addEventListener('pointerup', lift);
  stage.canvas.addEventListener('pointercancel', lift);
  stage.canvas.addEventListener('pointerleave', () => {
    lift();
    brushAt = null;
  });

  let quality = 0;
  function finish() {
    if (finished) return;
    finished = true;
    quality = cleaned();
    if (quality >= 1) {
      playSfx('trained');
      stage.emote('pet', 'sparkle', 4);
      stage.play('pet', 'hop');
      hint.textContent = `${pet.name} is squeaky clean!`;
    } else hint.textContent = quality > 0 ? `${Math.round(quality * 100)}% clean. Good enough for now.` : `${pet.name} is still muddy.`;
    actions.replaceChildren(h('button', { class: 'btn btn-primary', onclick: () => modal.close() }, 'Done'));
    actions.querySelector('button').focus();
  }

  const modal = openModal(body, {
    label: `Brushing ${pet.name}`,
    onClose: () => {
      if (!finished) quality = cleaned();
      stage.destroy();
      onComplete?.(quality);
    },
  });
  updateBar();
}
