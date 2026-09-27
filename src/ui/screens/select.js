/**
 * "Get an animal": a carousel, one animal per slide. Swipe, tap the arrows or
 * dots, or use the arrow keys. Only the starting moves are shown; a hint says
 * how many more can be learned. Tap an animal to hear its call. Adopting
 * takes whichever animal is showing.
 */
import { h } from '../dom.js';
import { go } from '../router.js';
import { game, adoptPet } from '../../core/state.js';
import { CONFIG } from '../../core/config.js';
import { SPECIES, SPECIES_ORDER } from '../../pets/species.js';
import { STAT_KEYS, STAT_LABELS, learnset } from '../../pets/pet.js';
import { ABILITIES } from '../../combat/abilities.js';
import { EXERCISES, EXERCISE_ORDER } from '../../training/exercises.js';
import { FOODS } from '../../foods/foods.js';
import { PetStage } from '../components/petStage.js';
import { createBar } from '../components/statBar.js';
import { playAnimalCall } from '../../audio/animalCalls.js';

// Used to scale the preview stat bars.
const STAT_MAX = { hp: 160, atk: 16, def: 12, spd: 17, crit: 0.25 };
const SWIPE_PX = 40; // how far a drag must go to change slides
const TRAINING_MOVE_COUNT = EXERCISE_ORDER.reduce((n, id) => n + EXERCISES[id].moves.length, 0);

let stages = [];
let cleanup = null;

function slideFor(id) {
  const sp = SPECIES[id];
  const stage = new PetStage({ width: 160, height: 76, background: 'meadow', label: `${sp.name}` });
  stage.addActor(id, { species: id, x: 80, y: 72 });
  stages.push(stage);

  const bars = STAT_KEYS.map((k) => {
    const bar = createBar({ label: STAT_LABELS[k], color: 'var(--c-yellow)', compact: true });
    bar.set(sp.base[k], STAT_MAX[k], k === 'crit' ? `${Math.round(sp.base[k] * 100)}%` : String(sp.base[k]));
    return bar.el;
  });

  const moves = learnset(id);
  const starting = moves.filter((m) => m.level === 1);
  const later = moves.length - starting.length;
  // one line that shows the "more moves" hint, or the tapped move's description
  const hint = `✦ ${later} more moves unlock as your ${sp.name.toLowerCase()} levels up, plus ${TRAINING_MOVE_COUNT} training moves. Tap a move to read it.`;
  const info = h('p', { class: 'slide-move-info more-moves', 'aria-live': 'polite' }, hint);
  const moveChips = starting.map(({ id: aid }) => {
    const a = ABILITIES[aid];
    const btn = h('button', { class: 'move-chip', type: 'button', 'aria-pressed': 'false' }, a.name, h('small', {}, a.cooldown ? `CD ${a.cooldown}` : 'Basic'));
    btn.addEventListener('click', () => {
      const on = btn.getAttribute('aria-pressed') !== 'true'; // tap again to go back to the hint
      moveChips.forEach((c) => c.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', String(on));
      info.textContent = on ? `${a.name}: ${a.desc}` : hint;
      info.classList.toggle('more-moves', !on);
    });
    return btn;
  });

  const el = h(
    'section',
    { class: 'species-slide', 'aria-roledescription': 'slide', 'aria-label': `${sp.name}, ${sp.role}` },
    h(
      'div',
      { class: 'species-portrait', role: 'button', tabindex: '0', 'aria-label': `Hear the ${sp.name.toLowerCase()}'s call`, onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), call()) },
      stage.canvas,
      h('span', { class: 'portrait-hint', 'aria-hidden': 'true' }, '♪ tap'),
    ),
    h('div', { class: 'slide-title' }, h('h2', {}, sp.name), h('span', { class: 'tag' }, sp.role)),
    h('p', { class: 'species-tagline' }, sp.tagline),
    h('div', { class: 'species-bars' }, bars),
    h('h3', { class: 'slide-sub' }, 'Starting moves'),
    h('div', { class: 'move-chips' }, moveChips),
    info,
    h(
      'p',
      { class: 'slide-facts' },
      h('strong', {}, sp.passive.name), ` · Trains ${EXERCISES[sp.specialty].name} faster · Loves ${sp.favoriteFoods.map((f) => FOODS[f].name).join(', ')}`,
    ),
  );
  // its call: the animal rears up while it sounds off
  let callingUntil = 0;
  function call() {
    const now = performance.now();
    if (now < callingUntil) return; // let it finish
    const seconds = playAnimalCall(id);
    callingUntil = now + seconds * 1000;
    stage.animate(id, (p) => {
      const k = Math.sin(Math.min(1, p * 1.6) * Math.PI);
      return { dy: -Math.round(k * 5), angle: -0.14 * k, sy: 1 + 0.06 * k };
    }, Math.min(seconds, 1));
    stage.emote(id, 'note', 2);
  }
  return { id, el, stage, call };
}

export default {
  mount(root) {
    if (!game.player) return go('title');
    const slides = SPECIES_ORDER.map(slideFor);
    let index = 0;

    const track = h('div', { class: 'carousel-track' }, slides.map((s) => s.el));
    const viewport = h('div', { class: 'carousel-viewport' }, track);
    const prevBtn = h('button', { class: 'carousel-arrow', type: 'button', 'aria-label': 'Previous animal', onclick: () => show(index - 1) }, '‹');
    const nextBtn = h('button', { class: 'carousel-arrow', type: 'button', 'aria-label': 'Next animal', onclick: () => show(index + 1) }, '›');
    const dots = SPECIES_ORDER.map((id, i) =>
      h('button', { class: 'carousel-dot', type: 'button', 'aria-label': `Show ${SPECIES[id].name}`, onclick: () => show(i) }),
    );

    const nameInput = h('input', { class: 'input', id: 'pet-name', maxLength: CONFIG.PET_NAME_MAX, placeholder: 'Pet name' });
    const adoptWhich = h('span', { class: 'adopt-which' });
    const adoptBtn = h('button', { class: 'btn btn-primary btn-big', type: 'submit' }, 'Adopt', adoptWhich);
    const form = h(
      'form',
      { class: 'panel adopt-panel', onsubmit: adopt },
      h('label', { class: 'field-label', for: 'pet-name' }, 'Name your pet'),
      h('div', { class: 'input-row' }, nameInput, adoptBtn),
    );

    function show(i, { animate = true } = {}) {
      const prevDefault = SPECIES[SPECIES_ORDER[index]].defaultName;
      index = (i + slides.length) % slides.length; // wraps around
      const sp = SPECIES[SPECIES_ORDER[index]];
      track.classList.toggle('no-anim', !animate);
      track.style.transform = `translateX(${-index * 100}%)`;
      slides.forEach((s, k) => {
        s.el.setAttribute('aria-hidden', String(k !== index));
        s.el.inert = k !== index;
      });
      dots.forEach((d, k) => d.classList.toggle('is-active', k === index));
      if (!nameInput.value || nameInput.value === prevDefault) nameInput.value = sp.defaultName;
      adoptWhich.textContent = ` ${sp.name}`; // hidden on phones, where the slide shows who
      slides[index].stage.play(slides[index].id, 'hop');
    }

    // swipe: the track follows your finger, then snaps to a slide
    let drag = null;
    viewport.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return; // let move chips and arrows be tapped
      drag = { x: e.clientX, y: e.clientY, dx: 0, id: e.pointerId, horizontal: null, onAnimal: Boolean(e.target.closest('.species-portrait')) };
    });
    viewport.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (drag.horizontal == null && Math.hypot(dx, dy) > 6) {
        drag.horizontal = Math.abs(dx) > Math.abs(dy);
        if (drag.horizontal) viewport.setPointerCapture?.(e.pointerId);
      }
      if (!drag.horizontal) return;
      drag.dx = dx;
      track.classList.add('no-anim');
      track.style.transform = `translateX(calc(${-index * 100}% + ${dx}px))`;
    });
    const endDrag = (e) => {
      if (!drag) return;
      const { dx, horizontal, onAnimal } = drag;
      drag = null;
      if (horizontal == null && onAnimal && e.type === 'pointerup') return slides[index].call(); // a tap, not a swipe
      if (!horizontal) return;
      if (dx <= -SWIPE_PX) show(index + 1);
      else if (dx >= SWIPE_PX) show(index - 1);
      else show(index);
    };
    viewport.addEventListener('pointerup', endDrag);
    viewport.addEventListener('pointercancel', endDrag);

    const onKey = (e) => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') show(index - 1);
      else if (e.key === 'ArrowRight') show(index + 1);
    };
    window.addEventListener('keydown', onKey);
    cleanup = () => window.removeEventListener('keydown', onKey);

    function adopt(e) {
      e.preventDefault();
      const id = SPECIES_ORDER[index];
      adoptPet(id, nameInput.value.trim() || SPECIES[id].defaultName);
      go('home', { welcome: true });
    }

    root.append(
      h(
        'div',
        { class: 'screen select-screen' },
        h('header', { class: 'screen-head' }, h('h1', { class: 'h-small' }, 'Get an animal'), h('p', { class: 'muted' }, `Hi ${game.player.username}! Swipe to meet them, then pick your companion.`)),
        h(
          'div',
          { class: 'carousel panel', 'aria-roledescription': 'carousel', 'aria-label': 'Animals' },
          viewport,
          h('div', { class: 'carousel-nav' }, prevBtn, h('div', { class: 'carousel-dots' }, dots), nextBtn),
        ),
        form,
      ),
    );
    show(0, { animate: false });
  },

  unmount() {
    cleanup?.();
    cleanup = null;
    stages.forEach((s) => s.destroy());
    stages = [];
  },
};
