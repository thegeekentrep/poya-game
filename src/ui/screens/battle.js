/**
 * Arena screen: plays back events produced by combat/battle.js.
 */
import { h } from '../dom.js';
import { go } from '../router.js';
import { game, saveGame } from '../../core/state.js';
import { SPECIES } from '../../pets/species.js';
import { ABILITIES } from '../../combat/abilities.js';
import { learnedLine } from '../moveText.js';
import { EFFECTS, hasEffect } from '../../combat/effects.js';
import { playRound, cooldownLeft, forfeit } from '../../combat/battle.js';
import { chooseBotAbility, DIFFICULTIES } from '../../combat/bots.js';
import { applyBattleResult } from '../../combat/arena.js';
import { formatMoodMult } from '../../pets/mood.js';
import { NEEDS } from '../../pets/needs.js';
import { sleep, signed } from '../../core/utils.js';
import { PetStage } from '../components/petStage.js';
import { performMove, performImpact, performStatus, isAttackMove } from '../../sprites/moves.js';
import * as fx from '../../sprites/vfx.js';
import { createBar } from '../components/statBar.js';
import { openModal, confirmButton } from '../components/modal.js';
import { createSoundToggles } from '../components/soundToggles.js';
import { playSfx } from '../../audio/sfx.js';
import { playMoveCast, playMoveHit } from '../../audio/moveSounds.js';
import { setTrack } from '../../audio/music.js';

const EVENT_DELAY = { round: 250, use: 450, hit: 550, crit: 750, miss: 500, dot: 500, heal: 500, status: 500, faint: 700, end: 400, info: 450 };
const MAX_LOG = 80;
// the mystery opponent's reveal: silhouette, drumroll, then flash (seconds)
const REVEAL = { drumroll: 0.5, reveal: 1.9, ready: 2.4 };

let state = null;

/** mystery: hide who this is (name, level, species, HP numbers) until reveal() */
function fighterCard(f, { mystery = false } = {}) {
  const sp = SPECIES[f.species];
  let hidden = mystery;
  const hp = createBar({ label: 'HP', color: f.side === 'player' ? 'var(--c-green)' : 'var(--c-red)', warnLow: true });
  const chips = h('div', { class: 'chips effect-chips' });
  const nameEl = h('div', { class: 'fighter-name' });
  const el = h('div', { class: `fighter fighter--${f.side}` }, nameEl, hp.el, chips);
  function showName() {
    nameEl.replaceChildren(h('strong', {}, hidden ? '???' : f.name), h('span', { class: 'muted' }, hidden ? ' Lv ? ???' : ` Lv ${f.level} ${sp.name}`));
  }
  function update(hpValue = f.hp) {
    hp.set(hpValue, f.maxHp, hidden ? '???' : `${hpValue}/${f.maxHp}`);
    chips.replaceChildren(
      ...Object.entries(f.effects).map(([id, e]) => {
        const def = EFFECTS[id];
        const turns = id === 'stun' ? '' : ` ${e.turns}`;
        return h('span', { class: `chip chip--${def.kind}`, title: def.desc }, `${def.label}${turns}`);
      }),
    );
  }
  function reveal() {
    hidden = false;
    showName();
    update();
    el.classList.add('is-revealed');
  }
  showName();
  update();
  return { el, update, reveal };
}

export default {
  mount(root, { battle } = {}) {
    if (!battle || !game.pet) return go('home');
    const stage = new PetStage({ width: 192, height: 104, background: 'arena', className: 'arena-stage', label: `${battle.player.name} versus a mystery opponent` });
    stage.addActor('player', { species: battle.player.species, x: 56, y: 97 });
    stage.addActor('enemy', { species: battle.enemy.species, x: 136, y: 97, flip: true });

    const cards = { player: fighterCard(battle.player), enemy: fighterCard(battle.enemy, { mystery: true }) };
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
        h('header', { class: 'battle-head' }, h('h2', {}, 'Arena'), roundEl, createSoundToggles(), forfeitBtn),
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

    const other = (side) => (side === 'player' ? 'enemy' : 'player');
    let lastMove = null; // ability whose hits we are showing
    let moveEndsAt = 0; // when the current mover is back in place

    /** Shows one event. Returns how long to wait before the next one (ms). */
    function playEvent(ev) {
      addLog(ev.text, ev.kind);
      cards.player.update(ev.hp.player);
      cards.enemy.update(ev.hp.enemy);
      playEventSfx(ev);
      switch (ev.kind) {
        case 'use': {
          lastMove = ev.ability;
          if (isAttackMove(ev.ability)) stage.setHidden(ev.actor, false); // attacking breaks stealth
          const { contact, duration } = performMove(stage, ev.actor, other(ev.actor), ev.ability);
          moveEndsAt = performance.now() + duration * 1000;
          return contact * 1000;
        }
        case 'hit':
        case 'crit':
          performImpact(stage, other(ev.target), ev.target, lastMove, { crit: ev.kind === 'crit' });
          if (ev.kind === 'crit') stage.emote(ev.target, 'star', 2);
          break;
        case 'miss':
          stage.play(ev.target, 'dodge');
          break;
        case 'dot':
          stage.play(ev.target, 'hurt');
          performStatus(stage, ev.target, ev);
          break;
        case 'heal':
          stage.emote(ev.target, 'sparkle', 2);
          performStatus(stage, ev.target, ev);
          break;
        case 'status':
          if (ev.effect === 'stealth') stage.setHidden(ev.target, true);
          if (ev.revealed) stage.setHidden(ev.target, false);
          if (ev.effect === 'stun') stage.emote(ev.target, 'star');
          performStatus(stage, ev.target, ev);
          break;
        case 'faint':
          stage.setFainted(ev.target, true);
          break;
        case 'end':
          stage.play(ev.actor, 'hop');
          break;
      }
      return EVENT_DELAY[ev.kind] ?? 450;
    }

    // each move sounds like what it is: a swipe whooshes and rakes, a bite snaps, a howl howls
    function playEventSfx(ev) {
      if (ev.kind === 'use') playMoveCast(ev.ability, SPECIES[battle[ev.actor].species].voicePitch);
      else if (ev.kind === 'hit' || ev.kind === 'crit') {
        if (!playMoveHit(lastMove, { crit: ev.kind === 'crit' })) playSfx(ev.kind);
      } else if (['miss', 'dot', 'heal', 'faint'].includes(ev.kind)) playSfx(ev.kind);
      else if (ev.kind === 'status' && ev.effect) playSfx(EFFECTS[ev.effect].kind);
      else if (ev.kind === 'end') playSfx(ev.actor === 'player' ? 'win' : 'lose');
    }

    async function takeTurn(abilityId) {
      if (state.busy || battle.over) return;
      state.busy = true;
      updateControls();
      const enemyMove = chooseBotAbility(battle.enemy, battle.player);
      const events = playRound(battle, abilityId, enemyMove);
      for (const ev of events) {
        if (!state?.alive) return;
        // let the previous mover get back in place before the next move starts
        if (ev.kind === 'use') await sleep(Math.max(0, moveEndsAt - performance.now()));
        if (!state?.alive) return;
        let wait = EVENT_DELAY[ev.kind] ?? 450;
        try {
          wait = playEvent(ev);
        } catch (err) {
          console.error('[POYA] Battle animation failed:', err); // never let visuals freeze the fight
        }
        await sleep(wait);
      }
      for (const side of ['player', 'enemy']) stage.setHidden(side, hasEffect(battle[side], 'stealth'));
      if (!state?.alive) return;
      state.busy = false;
      cards.player.update();
      cards.enemy.update();
      updateControls();
      if (battle.over) finish();
    }

    function finish() {
      setTrack(null); // let the win / lose jingle stand alone
      updateControls();
      const r = applyBattleResult(game, battle);
      saveGame();
      const lines = [
        `${signed(r.trophies)} trophies (${game.record.trophies} total)`,
        `+${r.coins} coins`,
        `+${r.xp} XP`,
        ...Object.entries(r.needs).map(([k, v]) => `${NEEDS[k].label} ${signed(v)}`),
      ];
      if (r.levels) lines.push(`LEVEL UP! ${game.pet.name} is now Lv ${r.level}`);
      for (const id of r.learned) lines.push(learnedLine(game.pet, id));
      const unlocks = r.unlocked.map((id) => h('p', { class: 'tier-unlock' }, `${DIFFICULTIES[id].label} tier unlocked!`));
      if (unlocks.length) setTimeout(() => playSfx('levelup'), 900); // after the win jingle
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
          unlocks,
          h('ul', { class: 'result-list' }, lines.map((l) => h('li', {}, l))),
          h('button', { class: 'btn btn-primary btn-big', onclick: () => modal.close() }, 'Back to camp'),
        ),
        { label: title, onClose: () => go('home', { tab: 'battle' }) },
      );
    }

    // ── the reveal: nobody knows who the opponent is until now ──
    const enemySp = SPECIES[battle.enemy.species];
    state.busy = true;
    setTrack(null); // silence, then the drumroll
    stage.setIdle('enemy', () => ({ variant: 'shadow' }));
    addLog(`${battle.player.name} enters the arena. A mystery challenger steps out of the shadows...`, 'info');
    stage.emote('enemy', 'question', 2);
    updateControls();
    const at = (sec, fn) => setTimeout(() => state?.alive && fn(), sec * 1000);
    at(REVEAL.drumroll, () => {
      playSfx('drumroll');
      stage.shake(0.8, REVEAL.reveal - REVEAL.drumroll);
    });
    at(REVEAL.reveal, () => {
      stage.setIdle('enemy', null);
      stage.effect(fx.flash('#f4f4f4', 0.8), 0.45);
      stage.shake(3, 0.35);
      stage.play('enemy', 'hop');
      stage.emote('enemy', 'anger', 2);
      cards.enemy.reveal();
      stage.canvas.setAttribute('aria-label', `${battle.player.name} versus ${battle.enemy.name} the ${enemySp.name}`);
      playSfx('reveal');
      addLog(`It's ${battle.enemy.name}, a Lv ${battle.enemy.level} ${enemySp.name} (${enemySp.role})!`, 'info');
      setTrack('battle');
    });
    at(REVEAL.ready, () => {
      state.busy = false;
      addLog('Choose your move!', 'info');
      updateControls();
    });
  },

  unmount() {
    if (state) {
      state.alive = false;
      state.stage.destroy();
    }
    state = null;
  },
};
