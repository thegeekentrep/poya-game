/**
 * Arena screen: plays back events produced by combat/battle.js.
 */
import { h } from '../dom.js';
import { go } from '../router.js';
import { game, saveGame } from '../../core/state.js';
import { SPECIES } from '../../pets/species.js';
import { ABILITIES } from '../../combat/abilities.js';
import { EFFECTS } from '../../combat/effects.js';
import { playRound, cooldownLeft, forfeit } from '../../combat/battle.js';
import { chooseBotAbility } from '../../combat/bots.js';
import { applyBattleResult } from '../../combat/arena.js';
import { formatMoodMult } from '../../pets/mood.js';
import { NEEDS } from '../../pets/needs.js';
import { sleep, signed } from '../../core/utils.js';
import { PetStage } from '../components/petStage.js';
import { createBar } from '../components/statBar.js';
import { openModal, confirmButton } from '../components/modal.js';

const EVENT_DELAY = { round: 250, use: 450, hit: 550, crit: 750, miss: 500, dot: 500, heal: 500, status: 500, faint: 700, end: 400, info: 450 };
const MAX_LOG = 80;

let state = null;

function fighterCard(f) {
  const sp = SPECIES[f.species];
  const hp = createBar({ label: 'HP', color: f.side === 'player' ? 'var(--c-green)' : 'var(--c-red)', warnLow: true });
  const chips = h('div', { class: 'chips effect-chips' });
  const el = h(
    'div',
    { class: `fighter fighter--${f.side}` },
    h('div', { class: 'fighter-name' }, h('strong', {}, f.name), h('span', { class: 'muted' }, ` Lv ${f.level} ${sp.name}`)),
    hp.el,
    chips,
  );
  function update(hpValue = f.hp) {
    hp.set(hpValue, f.maxHp, `${hpValue}/${f.maxHp}`);
    chips.replaceChildren(
      ...Object.entries(f.effects).map(([id, e]) => {
        const def = EFFECTS[id];
        const turns = id === 'stun' ? '' : ` ${e.turns}`;
        return h('span', { class: `chip chip--${def.kind}`, title: def.desc }, `${def.label}${turns}`);
      }),
    );
  }
  update();
  return { el, update };
}

export default {
  mount(root, { battle } = {}) {
    if (!battle || !game.pet) return go('home');
    const stage = new PetStage({ width: 192, height: 104, background: 'arena', className: 'arena-stage', label: `${battle.player.name} versus ${battle.enemy.name}` });
    stage.addActor('player', { species: battle.player.species, x: 60, y: 97, scale: 2 });
    stage.addActor('enemy', { species: battle.enemy.species, x: 132, y: 97, scale: 2, flip: true });

    const cards = { player: fighterCard(battle.player), enemy: fighterCard(battle.enemy) };
    const roundEl = h('span', { class: 'round-label' });
    const log = h('ol', { class: 'battle-log', 'aria-live': 'polite' });
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const info = h('p', { class: 'ability-info muted' }, touch ? 'Tap a move to use it. Hold a move to read what it does.' : 'Choose a move.');

    const abilityButtons = battle.player.abilities.map((id) => {
      const a = ABILITIES[id];
      const cd = h('span', { class: 'ability-cd' });
      const describe = () => (info.textContent = `${a.name}: ${a.desc}`);
      let holdTimer = 0;
      let held = false;
      const release = () => clearTimeout(holdTimer);
      const btn = h(
        'button',
        {
          class: 'ability-btn',
          onclick: () => {
            if (held) return (held = false); // a long-press only shows the description
            takeTurn(id);
          },
          onpointerdown: () => {
            held = false;
            holdTimer = setTimeout(() => {
              held = true;
              describe();
              navigator.vibrate?.(10);
            }, 450);
          },
          onpointerup: release,
          onpointerleave: release,
          onpointercancel: release,
          oncontextmenu: (e) => e.preventDefault(),
          onmouseenter: describe,
          onfocus: describe,
        },
        h('span', { class: 'ability-btn-name' }, a.name),
        cd,
      );
      return { id, btn, cd };
    });

    const forfeitBtn = confirmButton('Forfeit', 'Really give up?', () => {
      forfeit(battle);
      addLog(`${battle.player.name} gives up the fight.`, 'info');
      finish();
    }, 'btn btn-ghost btn-small');

    const moodNote = formatMoodMult(battle.player.moodMult);
    root.append(
      h(
        'div',
        { class: 'screen battle-screen' },
        h('header', { class: 'battle-head' }, h('h2', {}, 'Arena'), roundEl, forfeitBtn),
        h('div', { class: 'fighters' }, cards.player.el, h('span', { class: 'vs' }, 'VS'), cards.enemy.el),
        h('div', { class: 'stage-frame arena-frame' }, stage.canvas),
        moodNote && h('p', { class: 'muted mood-note' }, `${battle.player.name}'s mood modifies their damage by ${moodNote}.`),
        h('div', { class: 'panel ability-panel' }, h('div', { class: 'ability-grid' }, abilityButtons.map((b) => b.btn)), info),
        h('section', { class: 'panel log-panel' }, h('h3', {}, 'Battle log'), log),
      ),
    );

    state = { battle, stage, cards, alive: true, busy: false };

    function addLog(text, kind) {
      log.append(h('li', { class: `log log--${kind}` }, text));
      while (log.children.length > MAX_LOG) log.firstChild.remove();
      log.scrollTop = log.scrollHeight;
    }

    function updateControls() {
      roundEl.textContent = battle.over ? 'Finished' : `Round ${battle.round}`;
      for (const { id, btn, cd } of abilityButtons) {
        const left = cooldownLeft(battle.player, id);
        cd.textContent = left > 0 ? `CD ${left}` : ABILITIES[id].cooldown ? 'Ready' : 'Basic';
        btn.disabled = state.busy || battle.over || left > 0;
      }
      forfeitBtn.disabled = state.busy || battle.over;
    }

    function playEvent(ev) {
      addLog(ev.text, ev.kind);
      cards.player.update(ev.hp.player);
      cards.enemy.update(ev.hp.enemy);
      if (ev.kind === 'use') stage.play(ev.actor, 'attack');
      if (['hit', 'crit', 'dot'].includes(ev.kind)) stage.play(ev.target, 'hurt');
      if (ev.kind === 'crit') stage.emote(ev.target, 'star', 2);
      if (ev.kind === 'heal') stage.emote(ev.target, 'sparkle', 2);
      if (ev.kind === 'status' && ev.effect === 'stun') stage.emote(ev.target, 'star');
      if (ev.kind === 'faint') stage.setFainted(ev.target, true);
      if (ev.kind === 'end') stage.play(ev.actor, 'hop');
    }

    async function takeTurn(abilityId) {
      if (state.busy || battle.over) return;
      state.busy = true;
      updateControls();
      const enemyMove = chooseBotAbility(battle.enemy, battle.player);
      const events = playRound(battle, abilityId, enemyMove);
      for (const ev of events) {
        if (!state?.alive) return;
        playEvent(ev);
        await sleep(EVENT_DELAY[ev.kind] ?? 450);
      }
      if (!state?.alive) return;
      state.busy = false;
      cards.player.update();
      cards.enemy.update();
      updateControls();
      if (battle.over) finish();
    }

    function finish() {
      updateControls();
      const r = applyBattleResult(game, battle);
      saveGame();
      const lines = [`+${r.coins} coins`, `+${r.xp} XP`, ...Object.entries(r.needs).map(([k, v]) => `${NEEDS[k].label} ${signed(v)}`)];
      if (r.levels) lines.push(`LEVEL UP! ${game.pet.name} is now Lv ${r.level}`);
      const title = r.won ? 'Victory!' : 'Defeat';
      const flavor = r.won
        ? `${game.pet.name} defeated ${battle.enemy.name}!`
        : `${game.pet.name} lost to ${battle.enemy.name}. Rest, eat and train, then try again.`;
      const modal = openModal(
        h(
          'div',
          { class: `result result--${r.won ? 'win' : 'loss'}` },
          h('h2', {}, title),
          h('p', {}, flavor),
          h('ul', { class: 'result-list' }, lines.map((l) => h('li', {}, l))),
          h('button', { class: 'btn btn-primary btn-big', onclick: () => modal.close() }, 'Back to camp'),
        ),
        { label: title, onClose: () => go('home', { tab: 'battle' }) },
      );
    }

    addLog(`${battle.player.name} enters the arena against ${battle.enemy.name}!`, 'info');
    updateControls();
  },

  unmount() {
    if (state) {
      state.alive = false;
      state.stage.destroy();
    }
    state = null;
  },
};
