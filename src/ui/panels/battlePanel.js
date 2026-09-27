import { h } from '../dom.js';
import { game, saveGame } from '../../core/state.js';
import { go } from '../router.js';
import { SPECIES_ORDER } from '../../pets/species.js';
import { getMood, formatMoodMult } from '../../pets/mood.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, generateBot, botLevelRange } from '../../combat/bots.js';
import { ARENA_RULES, TROPHY_RULES, canBattle, estimateRewards, startBattle, isTierUnlocked, nextTier, highestUnlocked } from '../../combat/arena.js';
import { describeEffects } from '../../foods/feeding.js';
import { PetStage } from '../components/petStage.js';
import { createBar } from '../components/statBar.js';

let lastDifficulty = null; // remembered between visits; defaults to the hardest open tier

const SHUFFLE_MS = 260; // how fast the mystery card flips through silhouettes

/**
 * The opponent is a secret: picked at random when you press Fight and only
 * revealed in the arena (see screens/battle.js).
 */
export function createBattlePanel(ctx) {
  // a slot machine of silhouettes: it could be anyone
  const mysteryStage = new PetStage({ width: 80, height: 68, label: 'A mystery opponent' });
  let shown = Math.floor(Math.random() * SPECIES_ORDER.length);
  mysteryStage.addActor('who', { species: SPECIES_ORDER[shown], x: 40, y: 65, flip: true });
  mysteryStage.setIdle('who', () => ({ variant: 'shadow' }));
  const shuffle = setInterval(() => {
    shown = (shown + 1) % SPECIES_ORDER.length;
    mysteryStage.setActor('who', { species: SPECIES_ORDER[shown] });
  }, SHUFFLE_MS);
  let fightBtn = null;

  if (!lastDifficulty || !isTierUnlocked(game.record, lastDifficulty)) lastDifficulty = highestUnlocked(game.record);

  const status = h('p', { class: 'panel-note battle-status' });
  const trophyNote = h('p', { class: 'trophy-note' });
  const trophyBar = createBar({ label: 'Next tier', color: 'var(--c-yellow)', compact: true });
  const diffButtons = DIFFICULTY_ORDER.map((id) =>
    h('button', { class: 'seg', 'aria-pressed': 'false', onclick: () => { lastDifficulty = id; render(); } }, DIFFICULTIES[id].label),
  );
  const costText = `Entering the arena costs ${describeEffects(ARENA_RULES.cost)}. Wins earn trophies, losses cost ${TROPHY_RULES.loss}.`;
  const preview = h('div', { class: 'opponent' });

  const el = h(
    'div',
    { class: 'battle-panel' },
    status,
    trophyNote,
    trophyBar.el,
    h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Difficulty' }, diffButtons),
    preview,
  );

  function render() {
    const rec = game.record;
    diffButtons.forEach((b, i) => {
      const id = DIFFICULTY_ORDER[i];
      const open = isTierUnlocked(rec, id);
      const active = id === lastDifficulty;
      b.disabled = !open;
      b.classList.toggle('is-locked', !open);
      b.replaceChildren(DIFFICULTIES[id].label, open ? '' : h('span', { class: 'seg-lock' }, ` · ${TROPHY_RULES.unlock[id]}`));
      b.title = open ? `Win: +${TROPHY_RULES.win[id]} trophies · Loss: −${TROPHY_RULES.loss}` : `Locked: reach ${TROPHY_RULES.unlock[id]} trophies`;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    const next = nextTier(rec);
    trophyNote.textContent = next
      ? `Trophies: ${rec.trophies}. Reach ${next.at} to unlock ${DIFFICULTIES[next.id].label} (${next.need} to go).`
      : `Trophies: ${rec.trophies}. Every tier is unlocked!`;
    trophyBar.el.hidden = !next;
    if (next) {
      trophyBar.setLabel(`Trophies → ${DIFFICULTIES[next.id].label}`);
      const from = TROPHY_RULES.unlock[DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(next.id) - 1]];
      trophyBar.set(rec.bestTrophies - from, next.at - from, `${rec.bestTrophies}/${next.at}`);
    }
    const { min, max } = botLevelRange(game.pet, lastDifficulty);
    const rewards = estimateRewards(Math.round((min + max) / 2), lastDifficulty);
    fightBtn = h('button', { class: 'btn btn-danger btn-big', onclick: fight }, 'Fight!');
    preview.replaceChildren(
      h(
        'div',
        { class: 'opponent-card is-mystery' },
        h('div', { class: 'opponent-portrait' }, mysteryStage.canvas, h('span', { class: 'mystery-mark', 'aria-hidden': 'true' }, '?')),
        h(
          'div',
          { class: 'opponent-info' },
          h('h3', {}, '??? Mystery rival'),
          h('p', {}, `Lv ${min === max ? min : `${min}–${max}`} · species unknown`),
          h('p', { class: 'muted opponent-tagline' }, `${DIFFICULTIES[lastDifficulty].desc} You'll find out who in the arena.`),
          h('p', { class: 'reward' }, `Win: ~+${rewards.coins}c · ~+${rewards.xp} XP · +${TROPHY_RULES.win[lastDifficulty]} `, h('span', { class: 'reward-trophies' }, 'trophies')),
          h('p', { class: 'muted opponent-cost' }, costText),
        ),
        h('div', { class: 'opponent-actions' }, fightBtn),
      ),
    );
    update();
  }

  function fight() {
    const check = canBattle(game.pet);
    if (!check.ok) return ctx.toast(check.reason, 'warn');
    const bot = generateBot(game.pet, lastDifficulty); // decided only now, at random
    const battle = startBattle(game, bot, lastDifficulty);
    saveGame();
    go('battle', { battle });
  }

  function update() {
    const pet = game.pet;
    const check = canBattle(pet);
    const mood = getMood(pet);
    status.textContent = check.ok ? `${pet.name} is ready to fight. Mood: ${mood.label} ${formatMoodMult(mood.mult)} power` : check.reason;
    status.classList.toggle('is-warn', !check.ok);
    if (fightBtn) fightBtn.disabled = !check.ok;
  }

  render();
  return {
    el,
    update,
    destroy: () => {
      clearInterval(shuffle);
      mysteryStage.destroy();
    },
  };
}
