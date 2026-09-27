import { h } from '../dom.js';
import { game, saveGame } from '../../core/state.js';
import { go } from '../router.js';
import { SPECIES } from '../../pets/species.js';
import { getMood, formatMoodMult } from '../../pets/mood.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, generateBot } from '../../combat/bots.js';
import { ARENA_RULES, TROPHY_RULES, canBattle, estimateRewards, startBattle, isTierUnlocked, nextTier, highestUnlocked } from '../../combat/arena.js';
import { describeEffects } from '../../foods/feeding.js';
import { PetStage } from '../components/petStage.js';
import { createBar } from '../components/statBar.js';

let lastDifficulty = null; // remembered between visits; defaults to the hardest open tier

export function createBattlePanel(ctx) {
  let bot = null;
  let previewStage = null;
  let fightBtn = null;

  if (!lastDifficulty || !isTierUnlocked(game.record, lastDifficulty)) lastDifficulty = highestUnlocked(game.record);

  const status = h('p', { class: 'panel-note' });
  const trophyNote = h('p', { class: 'trophy-note' });
  const trophyBar = createBar({ label: 'Next tier', color: 'var(--c-yellow)', compact: true });
  const diffButtons = DIFFICULTY_ORDER.map((id) =>
    h('button', { class: 'seg', 'aria-pressed': 'false', onclick: () => { lastDifficulty = id; bot = null; render(); } }, DIFFICULTIES[id].label),
  );
  const diffDesc = h('p', { class: 'muted' });
  const findBtn = h('button', { class: 'btn', onclick: () => { bot = generateBot(game.pet, lastDifficulty); render(); } }, 'Find opponent');
  const preview = h('div', { class: 'opponent' });

  const el = h(
    'div',
    { class: 'battle-panel' },
    status,
    trophyNote,
    trophyBar.el,
    h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Difficulty' }, diffButtons),
    diffDesc,
    h('p', { class: 'muted' }, `Entering the arena costs ${describeEffects(ARENA_RULES.cost)}. Wins earn trophies, losses cost ${TROPHY_RULES.loss}.`),
    findBtn,
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
      b.textContent = open ? DIFFICULTIES[id].label : `${DIFFICULTIES[id].label} · ${TROPHY_RULES.unlock[id]}`;
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
      const from = TROPHY_RULES.unlock[DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(next.id) - 1]];
      trophyBar.set(rec.bestTrophies - from, next.at - from, `${rec.bestTrophies}/${next.at}`);
    }
    diffDesc.textContent = DIFFICULTIES[lastDifficulty].desc;
    findBtn.textContent = bot ? 'Reroll opponent' : 'Find opponent';

    previewStage?.destroy();
    previewStage = null;
    fightBtn = null;
    preview.replaceChildren();
    if (!bot) return update();

    const sp = SPECIES[bot.species];
    const rewards = estimateRewards(bot.level, lastDifficulty);
    previewStage = new PetStage({ width: 80, height: 68, label: `${bot.name} the ${sp.name}` });
    previewStage.addActor('bot', { species: bot.species, x: 40, y: 65, flip: true });
    fightBtn = h('button', { class: 'btn btn-danger btn-big', onclick: fight }, 'Fight!');
    preview.append(
      h(
        'div',
        { class: 'opponent-card' },
        h('div', { class: 'opponent-portrait' }, previewStage.canvas),
        h(
          'div',
          { class: 'opponent-info' },
          h('h3', {}, bot.name),
          h('p', {}, `Lv ${bot.level} ${sp.name} · ${sp.role}`),
          h('p', { class: 'muted' }, sp.tagline),
          h('p', { class: 'reward' }, `Win: +${rewards.coins}c · +${rewards.xp} XP · +${TROPHY_RULES.win[lastDifficulty]} trophies`),
        ),
        fightBtn,
      ),
    );
    update();
  }

  function fight() {
    const check = canBattle(game.pet);
    if (!check.ok) return ctx.toast(check.reason, 'warn');
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
  return { el, update, destroy: () => previewStage?.destroy() };
}
