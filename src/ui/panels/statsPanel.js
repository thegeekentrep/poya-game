import { h } from '../dom.js';
import { game, resetGame, saveGame } from '../../core/state.js';
import { go } from '../router.js';
import { STAT_KEYS, STAT_LABELS, LOADOUT_SIZE, getSpecies, getStats, formatStat, learnset, getLoadout, setEquipped } from '../../pets/pet.js';
import { ABILITIES } from '../../combat/abilities.js';
import { FOODS } from '../../foods/foods.js';
import { formatDuration } from '../../core/utils.js';
import { confirmButton, openModal } from '../components/modal.js';
import { createPopover } from '../components/popover.js';
import { staminaSaving, offeredMoves } from '../../training/trainer.js';
import { EXERCISES, EXERCISE_ORDER, TRAINING_RULES } from '../../training/exercises.js';

const STAT_SHORT = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD', crit: 'CRIT' };

export function createStatsPanel() {
  const pet = game.pet;
  const sp = getSpecies(pet);
  const lv = pet.level - 1;

  const el = h('div', { class: 'stats-panel' });
  const pop = createPopover(el); // phones: details of an equipped move
  let modal = null; // phones: the open Moves or Profile sheet, re-rendered on changes

  function toggleMove(id, equip) {
    if (setEquipped(pet, id, equip)) saveGame();
    render();
  }

  function openSheet(title, content) {
    const body = h('div', { class: 'stats-sheet' });
    const heading = h('h2', { tabindex: '-1' }, title);
    const draw = () => body.replaceChildren(heading, ...content(), h('div', { class: 'btn-row' }, h('button', { class: 'btn btn-primary', onclick: () => modal?.close() }, 'Done')));
    draw();
    const m = openModal(body, { label: title, onClose: () => (modal = null) });
    heading.focus(); // not the first button: in Profile that would be "Release"
    modal = { ...m, draw };
  }

  function render() {
    pop.close();
    const stats = getStats(pet);
    const moves = learnset(pet.species);
    const loadout = getLoadout(pet);
    // lockText: why an unknown move isn't available yet
    const moveRow = ({ id, known, lockText, basic = false }) => {
      const a = ABILITIES[id];
      const equipped = loadout.includes(id);
      let control;
      if (basic) control = h('span', { class: 'tag' }, 'Always equipped');
      else if (!known) control = h('span', { class: 'tag' }, lockText);
      else if (equipped) control = h('button', { class: 'btn btn-small', onclick: () => toggleMove(id, false) }, 'Unequip');
      else control = h('button', { class: 'btn btn-small', disabled: loadout.length >= LOADOUT_SIZE, onclick: () => toggleMove(id, true) }, 'Equip');
      return h(
        'li',
        { class: `move-row${known ? '' : ' is-locked'}` },
        h(
          'div',
          { class: 'move-info' },
          h('div', { class: 'ability-name' }, a.name, h('span', { class: 'tag' }, a.cooldown ? `CD ${a.cooldown}` : 'Basic'), equipped && h('span', { class: 'tag tag--favorite' }, 'Equipped')),
          h('div', { class: 'food-desc' }, a.desc),
        ),
        control,
      );
    };
    const levelMoves = moves.map(({ level, id }, i) => ({ id, known: level <= pet.level, lockText: `Learns at Lv ${level}`, basic: i === 0 }));
    const stationMoves = EXERCISE_ORDER.flatMap((ex) =>
      EXERCISES[ex].moves.map((id, tier) => ({
        id,
        known: pet.trainingMoves.includes(id),
        lockText: offeredMoves(pet, ex).includes(id) ? 'Ready! Learn in Train' : `${EXERCISES[ex].name} mastery ${TRAINING_RULES.masteryTiers[tier]}`,
      })),
    );
    const statRows = () => STAT_KEYS.map((k) =>
      h(
        'tr',
        {},
        h('th', { scope: 'row' }, STAT_LABELS[k]),
        h('td', {}, formatStat(k, sp.base[k] + sp.growth[k] * lv)),
        h('td', { class: 'num-good' }, `+${formatStat(k, pet.trained[k] || 0)}`),
        h('td', {}, h('strong', {}, formatStat(k, stats[k]))),
      ),
    );
    const rec = game.record;
    // the pieces, shared by the desktop layout and the phone sheets
    const statTable = () => [
      h('h3', {}, 'Combat stats'),
      h('table', { class: 'stat-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Stat'), h('th', {}, 'Level'), h('th', {}, 'Trained'), h('th', {}, 'Total'))), h('tbody', {}, statRows())),
      h('p', { class: 'muted' }, `Critical hits deal ${Math.round(sp.critMult * 100)}% damage.`),
    ];
    const profile = () => [
      h('h3', {}, 'Profile'),
      h(
        'ul',
        { class: 'plain-list' },
        h('li', {}, `Passive: ${sp.passive.name}: ${sp.passive.desc}`),
        h('li', {}, `Stamina: ${formatStat('sta', pet.trained.sta || 0)} (training costs ${Math.round(staminaSaving(pet) * 100)}% less energy)`),
        h('li', {}, `Loves: ${sp.favoriteFoods.map((f) => FOODS[f].name).join(', ')}`),
        h('li', {}, `Dislikes: ${sp.dislikedFoods.map((f) => FOODS[f].name).join(', ')}`),
        h('li', {}, `Record: ${rec.wins}W / ${rec.losses}L · best streak ${rec.bestStreak}`),
        h('li', {}, `Trophies: ${rec.trophies} (best ${rec.bestTrophies})`),
        h('li', {}, `Together for ${formatDuration(Date.now() - pet.adoptedAt)}`),
      ),
    ];
    const moveLists = () => [
      h('h3', {}, `Moves · ${loadout.length}/${LOADOUT_SIZE} equipped`),
      h('p', { class: 'muted' }, `${pet.name} learns a new move every level up to Lv ${moves.at(-1).level}. Equip up to ${LOADOUT_SIZE} for battle.`),
      h('ul', { class: 'ability-list' }, levelMoves.map(moveRow)),
      h('h3', {}, 'Training moves'),
      h('p', { class: 'muted' }, 'Any animal can learn these by building mastery at a training station.'),
      h('ul', { class: 'ability-list' }, stationMoves.map(moveRow)),
    ];
    const dangerZone = () =>
      h(
        'div',
        { class: 'danger-zone' },
        h('p', { class: 'muted' }, `Releasing ${pet.name} returns them to the wild and deletes all progress.`),
        confirmButton(`Release ${pet.name}`, 'Click again to confirm', () => {
          modal?.close();
          resetGame({ keepPlayer: true });
          go('select');
        }),
      );

    // phones: a one-screen summary; the long lists open as sheets
    const knownCount = levelMoves.filter((m) => m.known).length + stationMoves.filter((m) => m.known).length;
    const openMoves = () => openSheet('Moves', moveLists);
    const slot = (id) => {
      const a = ABILITIES[id];
      const btn = h('button', { class: 'loadout-slot', 'aria-haspopup': 'dialog', onclick: () => pop.toggle(id, btn, () => slotCard(id), a.name) }, h('span', {}, a.name), h('small', {}, a.cooldown ? `CD ${a.cooldown}` : 'Basic'));
      return btn;
    };
    const slotCard = (id) => {
      const a = ABILITIES[id];
      const basic = id === loadout[0];
      return [
        h('div', { class: 'popover-head' }, h('strong', {}, a.name), h('span', { class: 'tag' }, a.cooldown ? `CD ${a.cooldown}` : 'Basic')),
        h('p', { class: 'popover-muted' }, a.desc),
        h(
          'div',
          { class: 'popover-actions' },
          !basic && h('button', { class: 'btn btn-small btn-ghost', onclick: () => toggleMove(id, false) }, 'Unequip'),
          h('button', { class: 'btn btn-small btn-primary', onclick: () => { pop.close(); openMoves(); } }, 'Change moves'),
        ),
      ];
    };
    const compact = h(
      'div',
      { class: 'stats-compact' },
      h('div', { class: 'stat-chips' }, STAT_KEYS.map((k) => h('div', { class: 'stat-chip' }, h('small', {}, STAT_SHORT[k]), h('strong', {}, formatStat(k, stats[k]))))),
      h('div', { class: 'loadout-head' }, `Battle moves ${loadout.length}/${LOADOUT_SIZE}`),
      h(
        'div',
        { class: 'loadout-grid' },
        loadout.map(slot),
        Array.from({ length: LOADOUT_SIZE - loadout.length }, () => h('button', { class: 'loadout-slot is-empty', onclick: openMoves }, h('span', {}, '+ Add move'))),
      ),
      h(
        'div',
        { class: 'btn-row stats-buttons' },
        h('button', { class: 'btn btn-small', onclick: openMoves }, `Moves (${knownCount})`),
        h('button', { class: 'btn btn-small btn-ghost', onclick: () => openSheet(`${pet.name}'s profile`, () => [...statTable(), ...profile(), dangerZone()]) }, 'Profile'),
      ),
    );

    el.replaceChildren(
      compact,
      h('div', { class: 'stats-full' }, h('div', { class: 'stats-cols' }, h('section', {}, ...statTable(), ...profile()), h('section', {}, ...moveLists())), dangerZone()),
      pop.el,
    );
    modal?.draw();
  }

  render();
  return { el, destroy: pop.destroy };
}
