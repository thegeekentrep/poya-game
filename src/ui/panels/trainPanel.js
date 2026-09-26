import { h } from '../dom.js';
import { game, saveGame } from '../../core/state.js';
import { EXERCISES, EXERCISE_ORDER, TRAINING_RULES } from '../../training/exercises.js';
import { canTrain, canTrainNow, trainingProgress, isSpecialty } from '../../training/trainer.js';
import { STAT_LABELS, formatStat } from '../../pets/pet.js';
import { getMood, formatMoodMult } from '../../pets/mood.js';
import { describeEffects } from '../../foods/feeding.js';
import { createBar } from '../components/statBar.js';
import { openTrainingModal } from '../components/trainingModal.js';

export function createTrainPanel(ctx) {
  const refs = {};
  const status = h('p', { class: 'panel-note' });

  const rows = EXERCISE_ORDER.map((id) => {
    const ex = EXERCISES[id];
    const bar = createBar({ label: `${STAT_LABELS[ex.stat]} trained`, color: 'var(--c-cyan)', compact: true });
    const btn = h('button', { class: 'btn btn-small', onclick: () => start(id) }, 'Train');
    const reason = h('span', { class: 'train-reason' });
    refs[id] = { bar, btn, reason };
    return h(
      'li',
      { class: 'train-row' },
      h(
        'div',
        { class: 'train-info' },
        h('div', { class: 'train-name' }, ex.name, isSpecialty(game.pet, id) && h('span', { class: 'tag tag--favorite' }, '★ Specialty')),
        h('div', { class: 'food-desc' }, ex.desc),
        bar.el,
        reason,
      ),
      btn,
    );
  });

  function start(id) {
    const check = canTrain(game.pet, id);
    if (!check.ok) return ctx.toast(check.reason, 'warn');
    openTrainingModal({
      pet: game.pet,
      exerciseId: id,
      onComplete: (result) => {
        if (result) {
          saveGame();
          ctx.react(result.avgQ >= 0.6 ? 'happy' : 'sad');
          ctx.onLevelUp(result.levels);
        }
        ctx.refresh();
      },
    });
  }

  const el = h(
    'div',
    {},
    status,
    h('p', { class: 'panel-note muted' }, `Each session: ${describeEffects(TRAINING_RULES.cost)}. Happier pets get a wider target zone and bigger gains.`),
    h('ul', { class: 'train-list' }, rows),
  );

  function update() {
    const pet = game.pet;
    const mood = getMood(pet);
    const condition = canTrainNow(pet);
    const boost = pet.buffs.trainingBoost ? ' · Protein boost ready (+30%)' : '';
    status.textContent = condition.ok ? `Mood: ${mood.label} ${formatMoodMult(mood.mult)}${boost}` : condition.reason;
    status.classList.toggle('is-warn', !condition.ok);
    for (const id of EXERCISE_ORDER) {
      const { current, cap } = trainingProgress(pet, id);
      const stat = EXERCISES[id].stat;
      refs[id].bar.set(current, cap, `${formatStat(stat, current)} / ${formatStat(stat, cap)}`);
      const check = canTrain(pet, id);
      refs[id].btn.disabled = !check.ok;
      refs[id].reason.textContent = condition.ok && !check.ok ? check.reason : '';
    }
  }

  update();
  return { el, update };
}
