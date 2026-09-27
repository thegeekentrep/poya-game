/**
 * Play mini-game: a feather teaser wand. Move the lure around; the pet chases it,
 * crouches when it dips low, then pounces. Yank it away in time and the pet misses.
 * Quality (catches / goal) scales the happiness gain in care/care.js.
 */
import { h } from '../dom.js';
import { openModal } from './modal.js';
import { PetStage } from './petStage.js';
import { SPRITES } from '../../sprites/animals.js';
import { spriteSize } from '../../sprites/renderer.js';
import * as P from '../../sprites/careProps.js';
import { playSfx } from '../../audio/sfx.js';
import { getStats } from '../../pets/pet.js';
import { clamp } from '../../core/utils.js';

const W = 192;
const H = 96;
const GROUND = 88;

export const PLAY_TUNING = {
  goal: 5, // catches to finish
  timeSec: 30,
  crouchSec: 0.45, // the tell before a pounce: your chance to yank the lure away
  pounceSec: 0.5,
  pounceHeight: 26,
  recoverSec: 0.45,
  holdSec: 0.9, // chewing on a caught lure
  catchRadius: 13,
  keyStep: 8, // lure movement per arrow key press
};
const T = PLAY_TUNING;

export function openPlayModal({ pet, onComplete }) {
  const { w: pw, h: ph } = spriteSize(SPRITES[pet.species]);
  const hover = SPRITES[pet.species].hover ?? 0;
  const runSpeed = clamp(40 + getStats(pet).spd * 2.5, 45, 110); // faster animals chase faster
  const stage = new PetStage({ width: W, height: H, background: 'meadow', label: `Playing with ${pet.name}` });
  const minX = pw / 2 + 2;
  const maxX = W - pw / 2 - 2;
  let x = minX + 10;
  let dir = 1;
  stage.addActor('pet', { species: pet.species, x, y: GROUND });

  const lure = { x: W * 0.7, y: 30 };
  let anchor = lure.x;
  let state = 'chase'; // chase | crouch | pounce | recover | hold
  let stateAt = 0;
  let pounce = null; // { x0, x1 }
  let catches = 0;
  let finished = false;
  let startAt = null;
  let last = null;

  const mouth = () => {
    const b = stage.actorBox('pet');
    return { x: b.x + dir * pw * 0.4, y: b.cy - ph * 0.15 - poseLift() };
  };
  const age = () => stage.now - stateAt;
  const setState = (s) => {
    state = s;
    stateAt = stage.now;
  };
  const poseLift = () => (state === 'pounce' ? Math.sin(Math.min(1, age() / T.pounceSec) * Math.PI) * T.pounceHeight : 0);
  const lureLow = () => lure.y > GROUND - ph - hover - 14;
  const inReach = () => Math.abs(lure.x - x) < pw / 2 + 34;

  // the pet's body language comes from its state
  stage.setIdle('pet', (t) => {
    const k = age();
    if (state === 'crouch') return { sy: 0.85, dx: Math.round(Math.sin(t * 40)) * -dir, angle: 0.1 }; // butt wiggle
    if (state === 'pounce') return { dy: -poseLift(), angle: Math.sin((k / T.pounceSec) * Math.PI * 2) * -0.2, trail: true };
    if (state === 'recover') return { sy: 1 - Math.max(0, 0.15 - k * 0.4) };
    if (state === 'hold') return { angle: 0.15, dx: Math.round(Math.sin(t * 30)) }; // shaking the prize
    return Math.abs(lure.x - x) > 4 ? { dy: -Math.round(Math.abs(Math.sin(t * 12)) * 2) } : {};
  });

  function update(t) {
    const dt = last == null ? 0 : Math.min(0.1, t - last);
    last = t;
    if (startAt == null) startAt = t;
    anchor += (lure.x - anchor) * Math.min(1, dt * 3); // the stick lags behind the lure
    if (finished) return;

    const k = age();
    if (state === 'chase') {
      const gap = lure.x - x;
      if (Math.abs(gap) > 2) {
        x = clamp(x + Math.sign(gap) * Math.min(Math.abs(gap), runSpeed * dt), minX, maxX);
        dir = Math.sign(gap);
      }
      if (lureLow() && inReach()) setState('crouch');
    } else if (state === 'crouch') {
      if (!lureLow() || !inReach()) setState('chase'); // lure pulled away before the pounce
      else if (k >= T.crouchSec) {
        pounce = { x0: x, x1: clamp(lure.x - dir * pw * 0.3, minX, maxX) };
        playSfx('pounce');
        setState('pounce');
      }
    } else if (state === 'pounce') {
      const p = Math.min(1, k / T.pounceSec);
      x = pounce.x0 + (pounce.x1 - pounce.x0) * p;
      const m = mouth();
      if (p > 0.25 && Math.hypot(m.x - lure.x, m.y - lure.y) < T.catchRadius) {
        catches += 1;
        playSfx('catch');
        stage.emote('pet', 'star', 2);
        setState('hold');
        updateHud();
      } else if (p >= 1) {
        if (Math.random() < 0.5) stage.emote('pet', 'drop');
        setState('recover');
      }
    } else if (state === 'recover' && k >= T.recoverSec) setState('chase');
    else if (state === 'hold') {
      const m = mouth();
      lure.x = m.x; // the lure is in its mouth
      lure.y = m.y;
      if (k >= T.holdSec) {
        lure.y = 24; // the wand whips back up
        setState('chase');
        if (catches >= T.goal) finish();
      }
    }
    stage.setActor('pet', { x, flip: dir < 0 });
    const left = Math.max(0, T.timeSec - (t - startAt));
    timer.textContent = `${Math.ceil(left)}s`;
    if (left <= 0) finish();
  }

  stage.setLayers({
    back: (ctx, t) => update(t),
    front: (ctx, t) => {
      P.featherWand(ctx, anchor, lure.x, lure.y, t);
      P.wandStick(ctx, anchor);
    },
  });

  // ── input: the lure follows the pointer (drag on touch), or arrow keys ──
  const toStage = (e) => {
    const r = stage.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  const moveLure = (p) => {
    if (state === 'hold' || finished) return;
    lure.x = clamp(p.x, 4, W - 4);
    lure.y = clamp(p.y, 8, GROUND - 8);
  };
  stage.canvas.style.touchAction = 'none';
  stage.canvas.tabIndex = 0;
  stage.canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    stage.canvas.setPointerCapture?.(e.pointerId);
    moveLure(toStage(e));
  });
  stage.canvas.addEventListener('pointermove', (e) => moveLure(toStage(e)));
  function onKey(e) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step || finished) return;
    e.preventDefault();
    moveLure({ x: lure.x + step[0] * T.keyStep, y: lure.y + step[1] * T.keyStep });
  }
  window.addEventListener('keydown', onKey);

  const score = h('span', {});
  const timer = h('span', {});
  const hint = h('p', { class: 'muted' }, 'Move the feather around. Dangle it low to tempt a pounce, and pull it away to tease!');
  const actions = h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-ghost', onclick: () => finish() }, 'Stop'));
  const body = h(
    'div',
    { class: 'training-sim care-game' },
    h('h2', {}, `Playing with ${pet.name}`),
    h('div', { class: 'stage-frame' }, stage.canvas),
    h('p', { class: 'care-hud' }, score, timer),
    hint,
    actions,
  );
  function updateHud() {
    score.textContent = `Catches ${catches} / ${T.goal}`;
  }

  function finish() {
    if (finished) return;
    finished = true;
    if (catches >= T.goal) {
      playSfx('trained');
      stage.emote('pet', 'heart', 3);
      stage.play('pet', 'hop');
      hint.textContent = `${pet.name} caught it every time. What a game!`;
    } else hint.textContent = catches ? `${pet.name} caught it ${catches} time${catches > 1 ? 's' : ''}.` : `${pet.name} didn't catch it this time.`;
    actions.replaceChildren(h('button', { class: 'btn btn-primary', onclick: () => modal.close() }, 'Done'));
    actions.querySelector('button').focus();
  }

  const modal = openModal(body, {
    label: `Playing with ${pet.name}`,
    onClose: () => {
      window.removeEventListener('keydown', onKey);
      stage.destroy();
      onComplete?.(catches / T.goal);
    },
  });
  updateHud();
  stage.canvas.focus();
}
