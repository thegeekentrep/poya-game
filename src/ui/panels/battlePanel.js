import { h } from '../dom.js';
import { game, saveGame } from '../../core/state.js';
import { go } from '../router.js';
import { SPECIES } from '../../pets/species.js';
import { getMood, formatMoodMult } from '../../pets/mood.js';
import { DIFFICULTIES, DIFFICULTY_ORDER, generateBot } from '../../combat/bots.js';
import { ARENA_RULES, canBattle, estimateRewards, startBattle } from '../../combat/arena.js';
import { describeEffects } from '../../foods/feeding.js';
import { PetStage } from '../components/petStage.js';

let lastDifficulty = 'normal';

export function createBattlePanel(ctx) {
  let bot = null;
  let previewStage = null;
  let fightBtn = null;

  const status = h('p', { class: 'panel-note' });
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
    h('div', { class: 'seg-group', role: 'group', 'aria-label': 'Difficulty' }, diffButtons),
    diffDesc,
    h('p', { class: 'muted' }, `Entering the arena costs ${describeEffects(ARENA_RULES.cost)}.`),
    findBtn,
    preview,
  );

  function render() {
    diffButtons.forEach((b, i) => {
      const active = DIFFICULTY_ORDER[i] === lastDifficulty;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    diffDesc.textContent = DIFFICULTIES[lastDifficulty].desc;
    findBtn.textContent = bot ? 'Reroll opponent' : 'Find opponent';

    previewStage?.destroy();
    previewStage = null;
    fightBtn = null;
    preview.replaceChildren();
    if (!bot) return update();

    const sp = SPECIES[bot.species];
    const rewards = estimateRewards(bot.level, lastDifficulty);
    previewStage = new PetStage({ width: 40, height: 24, label: `${bot.name} the ${sp.name}` });
    previewStage.addActor('bot', { species: bot.species, x: 20, y: 22, scale: 1, flip: true });
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
          h('p', { class: 'reward' }, `Win: +${rewards.coins}c · +${rewards.xp} XP`),
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
