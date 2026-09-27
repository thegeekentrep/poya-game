import { h } from '../dom.js';
import { game, saveGame } from '../../core/state.js';
import { EXERCISES, EXERCISE_ORDER } from '../../training/exercises.js';
import { canTrain, canTrainNow, statProgress, isSpecialty, trainingCost, staminaSaving, mastery, offeredMoves, nextStationMove, learnTrainingMove } from '../../training/trainer.js';
import { ABILITIES } from '../../combat/abilities.js';
import { learnedLine } from '../moveText.js';
import { STAT_LABELS, formatStat } from '../../pets/pet.js';
import { getMood, formatMoodMult } from '../../pets/mood.js';
import { describeEffects } from '../../foods/feeding.js';
import { createBar } from '../components/statBar.js';
import { createPopover } from '../components/popover.js';
import { openTrainingModal } from '../components/trainingModal.js';
import { STATION_ICONS } from '../../sprites/stationIcons.js';
import { spriteCanvas } from '../../sprites/renderer.js';

const stationIcon = (id) => spriteCanvas(STATION_ICONS[id], 3, 'station-icon');
const BAR_COLORS = { primary: 'var(--c-cyan)', secondary: 'var(--c-yellow)', mastery: 'var(--c-lime)' };

/** Where a station stands for this pet: stat progress, mastery and what's next. */
function stationState(pet, id) {
  const ex = EXERCISES[id];
  const primary = statProgress(pet, ex.primary);
  const secondary = statProgress(pet, ex.secondary);
  const m = mastery(pet, id);
  const masteryFrac = m.next ? (m.points - m.prev) / (m.next - m.prev) : 1;
  return { ex, primary, secondary, m, masteryFrac, upcoming: nextStationMove(pet, id), offered: offeredMoves(pet, id) };
}

export function createTrainPanel(ctx) {
  const refs = {};
  const el = h('div', { class: 'train-panel' });
  const pop = createPopover(el); // the details card
  const status = h('p', { class: 'panel-note train-status' });

  const rows = EXERCISE_ORDER.map((id) => {
    const ex = EXERCISES[id];
    const bar = createBar({ label: `${STAT_LABELS[ex.primary]} (primary)`, color: BAR_COLORS.primary, compact: true });
    const bar2 = createBar({ label: `${STAT_LABELS[ex.secondary]} (secondary)`, color: BAR_COLORS.secondary, compact: true });
    const btn = h('button', { class: 'btn btn-small', onclick: () => start(id) }, 'Train');
    const bar3 = createBar({ label: 'Mastery', color: BAR_COLORS.mastery, compact: true });
    const learn = h('div', { class: 'train-learn' });
    const reason = h('span', { class: 'train-reason' });
    // phones: the tile; desktop: the picture. Either opens the details card.
    const minis = Object.fromEntries(Object.entries(BAR_COLORS).map(([k, c]) => [k, h('span', { class: 'mini-bar', style: { '--c': c } })]));
    const ready = h('span', { class: 'station-ready', 'aria-hidden': 'true' }, '✦');
    const iconBtn = h(
      'button',
      { class: 'station-btn', 'aria-label': `${ex.name}: details`, 'aria-haspopup': 'dialog', onclick: () => togglePop(id) },
      stationIcon(id),
      isSpecialty(game.pet, id) && h('span', { class: 'station-star', 'aria-hidden': 'true' }, '★'),
      ready,
      h('span', { class: 'station-title' }, ex.short),
      h('span', { class: 'mini-bars' }, Object.values(minis)),
    );
    const row = h(
      'li',
      { class: 'train-row' },
      iconBtn,
      h(
        'div',
        { class: 'train-info' },
        h('div', { class: 'train-name' }, ex.name, isSpecialty(game.pet, id) && h('span', { class: 'tag tag--favorite' }, '★ Specialty')),
        h('div', { class: 'food-desc' }, ex.desc),
        bar.el,
        bar2.el,
        bar3.el,
        learn,
        reason,
      ),
      btn,
    );
    refs[id] = { row, bar, bar2, bar3, learn, btn, reason, iconBtn, minis, ready };
    return row;
  });

  function start(id) {
    const check = canTrain(game.pet, id);
    if (!check.ok) return ctx.toast(check.reason, 'warn');
    pop.close();
    openTrainingModal({
      pet: game.pet,
      exerciseId: id,
      onComplete: (result) => {
        if (result) {
          saveGame();
          ctx.react(result.avgQ >= 0.6 ? 'happy' : 'sad');
          ctx.onLevelUp(result.levels, result.learned);
        }
        ctx.refresh();
      },
    });
  }

  function learnMove(id, moveId) {
    if (!learnTrainingMove(game.pet, id, moveId)) return;
    saveGame();
    ctx.toast(learnedLine(game.pet, moveId), 'good', 3500);
    ctx.react('level');
    ctx.refresh();
  }

  const costText = (pet) => {
    const saving = Math.round(staminaSaving(pet) * 100);
    return `Each session: ${describeEffects(trainingCost(pet))}${saving ? ` (Stamina −${saving}% energy)` : ''}.`;
  };

  function popContent(id) {
    const pet = game.pet;
    const s = stationState(pet, id);
    const statBar = (key, stat, prog) => {
      const b = createBar({ label: STAT_LABELS[stat], color: BAR_COLORS[key], compact: true });
      b.set(prog.current, prog.cap, `${formatStat(stat, prog.current)} / ${formatStat(stat, prog.cap)}`);
      return b.el;
    };
    const masteryBar = createBar({ label: s.upcoming ? `Mastery → ${ABILITIES[s.upcoming].name}` : 'Mastery (complete)', color: BAR_COLORS.mastery, compact: true });
    masteryBar.set(s.masteryFrac, 1, s.m.next ? `${Math.floor(s.m.points)} / ${s.m.next}` : `Overload Lv ${s.m.tier}`);
    const check = canTrain(pet, id);
    return [
      h('div', { class: 'popover-head' }, stationIcon(id), h('strong', {}, s.ex.name), isSpecialty(pet, id) && h('span', { class: 'tag tag--favorite' }, '★ Specialty')),
      h('p', { class: 'popover-muted' }, s.ex.desc),
      statBar('primary', s.ex.primary, s.primary),
      statBar('secondary', s.ex.secondary, s.secondary),
      masteryBar.el,
      s.m.tier > 0 && h('p', { class: 'popover-muted' }, `Overload Lv ${s.m.tier}: the timing bar moves faster.`),
      !check.ok && h('p', { class: 'train-reason' }, check.reason),
      h('p', { class: 'popover-fx' }, costText(pet)),
      h(
        'div',
        { class: 'popover-actions' },
        ...s.offered.map((moveId) => h('button', { class: 'btn btn-small', onclick: () => learnMove(id, moveId) }, `✦ Learn ${ABILITIES[moveId].name}`)),
        h('button', { class: 'btn btn-small btn-primary', disabled: !check.ok, onclick: () => start(id) }, 'Train'),
      ),
    ];
  }

  function togglePop(id) {
    pop.toggle(id, refs[id].iconBtn, () => popContent(id), EXERCISES[id].name);
  }

  const costNote = h('p', { class: 'panel-note muted train-cost' });
  el.append(status, costNote, h('ul', { class: 'train-list' }, rows), pop.el);

  function update() {
    const pet = game.pet;
    const mood = getMood(pet);
    const condition = canTrainNow(pet);
    const boost = pet.buffs.trainingBoost ? ' · Protein boost ready (+30%)' : '';
    status.textContent = condition.ok ? `Mood: ${mood.label} ${formatMoodMult(mood.mult)}${boost}` : condition.reason;
    status.classList.toggle('is-warn', !condition.ok);
    costNote.textContent = `${costText(pet)} Happier pets get a wider target zone and bigger gains.`;
    for (const id of EXERCISE_ORDER) {
      const r = refs[id];
      const s = stationState(pet, id);
      for (const [bar, stat, prog] of [[r.bar, s.ex.primary, s.primary], [r.bar2, s.ex.secondary, s.secondary]]) {
        bar.set(prog.current, prog.cap, `${formatStat(stat, prog.current)} / ${formatStat(stat, prog.cap)}`);
      }
      r.bar3.setLabel(s.upcoming ? `Mastery → ${ABILITIES[s.upcoming].name}` : 'Mastery (complete)');
      if (s.m.next) r.bar3.set(s.m.points - s.m.prev, s.m.next - s.m.prev, `${Math.floor(s.m.points)} / ${s.m.next}${s.m.tier ? ` · Overload Lv ${s.m.tier}` : ''}`);
      else r.bar3.set(1, 1, `Mastered · Overload Lv ${s.m.tier}`);
      r.learn.replaceChildren(
        ...s.offered.map((moveId) => h('button', { class: 'btn btn-small btn-primary', onclick: () => learnMove(id, moveId) }, `✦ Learn ${ABILITIES[moveId].name}`)),
      );
      const check = canTrain(pet, id);
      r.btn.disabled = !check.ok;
      r.reason.textContent = condition.ok && !check.ok ? check.reason : '';
      // tile
      r.minis.primary.style.setProperty('--p', `${(s.primary.current / s.primary.cap) * 100}%`);
      r.minis.secondary.style.setProperty('--p', `${(s.secondary.current / s.secondary.cap) * 100}%`);
      r.minis.mastery.style.setProperty('--p', `${s.masteryFrac * 100}%`);
      r.ready.hidden = !s.offered.length;
      r.row.classList.toggle('is-blocked', !check.ok);
    }
    pop.refresh();
  }

  update();
  return { el, update, destroy: pop.destroy };
}
