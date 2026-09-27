/**
 * The training simulator UI: a timing bar the player hits with Space / click.
 * Logic lives in training/simulator.js; stat results in training/trainer.js.
 */
import { h } from '../dom.js';
import { openModal } from './modal.js';
import { PetStage } from './petStage.js';
import { TrainingSim, GRADES } from '../../training/simulator.js';
import { EXERCISES } from '../../training/exercises.js';
import { completeTraining } from '../../training/trainer.js';
import { getMood } from '../../pets/mood.js';
import { STAT_LABELS, formatStat } from '../../pets/pet.js';
import { playSfx } from '../../audio/sfx.js';

const GRADE_SFX = { perfect: 'perfect', good: 'good', miss: 'bad' };

export function openTrainingModal({ pet, exerciseId, onComplete }) {
  const ex = EXERCISES[exerciseId];
  const sim = new TrainingSim({ moodMult: getMood(pet).mult });

  const stage = new PetStage({ width: 192, height: 88, background: 'meadow', label: `${pet.name} training` });
  stage.addActor('pet', { species: pet.species, x: 96, y: 80 });

  const good = h('div', { class: 'sim-zone sim-zone--good' });
  const perfect = h('div', { class: 'sim-zone sim-zone--perfect' });
  const marker = h('div', { class: 'sim-marker' });
  const track = h('div', { class: 'sim-track', onpointerdown: (e) => { e.preventDefault(); hit(); } }, good, perfect, marker);
  const pips = h('div', { class: 'sim-pips' }, Array.from({ length: sim.reps }, () => h('span', { class: 'sim-pip' })));
  const feedback = h('p', { class: 'sim-feedback', 'aria-live': 'polite' }, 'Tap the bar (or press Space) when the marker is in the zone!');
  const hitBtn = h('button', { class: 'btn btn-primary btn-big', onpointerdown: (e) => { e.preventDefault(); hit(); } }, 'HIT!');
  const cancelBtn = h('button', { class: 'btn btn-ghost', onclick: () => modal.close() }, 'Cancel');
  const actions = h('div', { class: 'btn-row' }, hitBtn, cancelBtn);
  const body = h(
    'div',
    { class: 'training-sim' },
    h('h2', {}, `${ex.name} training`),
    h('p', { class: 'muted' }, ex.desc),
    h('div', { class: 'stage-frame' }, stage.canvas),
    track,
    pips,
    feedback,
    actions,
  );

  let raf = 0;
  let last = performance.now();
  let result = null;

  function placeZone() {
    const z = sim.zone;
    good.style.left = `${(z.center - z.good / 2) * 100}%`;
    good.style.width = `${z.good * 100}%`;
    perfect.style.left = `${(z.center - z.perfect / 2) * 100}%`;
    perfect.style.width = `${z.perfect * 100}%`;
  }

  function frame(now) {
    sim.update((now - last) / 1000);
    last = now;
    marker.style.left = `${sim.pos * 100}%`;
    if (!sim.done) raf = requestAnimationFrame(frame);
  }

  function hit() {
    const grade = sim.hit();
    if (!grade) return;
    const pip = pips.children[sim.results.length - 1];
    pip.classList.add(`is-${grade}`);
    feedback.textContent = GRADES[grade].label;
    feedback.dataset.grade = grade;
    playSfx(GRADE_SFX[grade]);
    if (grade === 'miss') stage.play('pet', 'hurt');
    else {
      stage.play('pet', 'hop');
      if (grade === 'perfect') stage.emote('pet', 'star', 2);
    }
    if (sim.done) finish();
    else placeZone();
  }

  function finish() {
    cancelAnimationFrame(raf);
    result = completeTraining(pet, exerciseId, sim.qualities);
    setTimeout(() => playSfx(result.levels ? 'levelup' : 'trained'), 250);
    const lines = [
      `${STAT_LABELS[result.stat]} ${result.gain > 0 ? '+' : ''}${formatStat(result.stat, result.gain)}`,
      `+${result.xp} XP`,
    ];
    if (result.specialty) lines.push('Specialty bonus ×1.5');
    if (result.boosted) lines.push('Protein boost ×1.3');
    if (result.levels) lines.push(`LEVEL UP! Now Lv ${pet.level}`);
    feedback.replaceChildren(h('strong', {}, 'Session complete'), h('ul', { class: 'result-list' }, lines.map((l) => h('li', {}, l))));
    actions.replaceChildren(h('button', { class: 'btn btn-primary', onclick: () => modal.close() }, 'Done'));
    actions.querySelector('button').focus();
  }

  function onKey(e) {
    if ((e.code === 'Space' || e.code === 'Enter') && !sim.done && !e.repeat) {
      e.preventDefault();
      hit();
    }
  }

  const modal = openModal(body, {
    label: `${ex.name} training`,
    onClose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      stage.destroy();
      onComplete?.(result); // null if cancelled
    },
  });
  window.addEventListener('keydown', onKey);
  placeZone();
  raf = requestAnimationFrame(frame);
}
