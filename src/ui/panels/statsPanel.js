import { h } from '../dom.js';
import { game, resetGame } from '../../core/state.js';
import { go } from '../router.js';
import { STAT_KEYS, STAT_LABELS, getSpecies, getStats, formatStat } from '../../pets/pet.js';
import { ABILITIES } from '../../combat/abilities.js';
import { FOODS } from '../../foods/foods.js';
import { formatDuration } from '../../core/utils.js';
import { confirmButton } from '../components/modal.js';

export function createStatsPanel() {
  const pet = game.pet;
  const sp = getSpecies(pet);
  const lv = pet.level - 1;

  const el = h('div', { class: 'stats-panel' });

  function render() {
    const stats = getStats(pet);
    const rows = STAT_KEYS.map((k) =>
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
    el.replaceChildren(
      h(
        'div',
        { class: 'stats-cols' },
        h(
          'section',
          {},
          h('h3', {}, 'Combat stats'),
          h('table', { class: 'stat-table' }, h('thead', {}, h('tr', {}, h('th', {}, 'Stat'), h('th', {}, 'Level'), h('th', {}, 'Trained'), h('th', {}, 'Total'))), h('tbody', {}, rows)),
          h('p', { class: 'muted' }, `Critical hits deal ${Math.round(sp.critMult * 100)}% damage.`),
          h('h3', {}, 'Profile'),
          h(
            'ul',
            { class: 'plain-list' },
            h('li', {}, `Passive: ${sp.passive.name}: ${sp.passive.desc}`),
            h('li', {}, `Loves: ${sp.favoriteFoods.map((f) => FOODS[f].name).join(', ')}`),
            h('li', {}, `Dislikes: ${sp.dislikedFoods.map((f) => FOODS[f].name).join(', ')}`),
            h('li', {}, `Record: ${rec.wins}W / ${rec.losses}L · best streak ${rec.bestStreak}`),
            h('li', {}, `Trophies: ${rec.trophies} (best ${rec.bestTrophies})`),
            h('li', {}, `Together for ${formatDuration(Date.now() - pet.adoptedAt)}`),
          ),
        ),
        h(
          'section',
          {},
          h('h3', {}, 'Abilities'),
          h(
            'ul',
            { class: 'ability-list' },
            sp.abilities.map((id) => {
              const a = ABILITIES[id];
              return h('li', {}, h('div', { class: 'ability-name' }, a.name, h('span', { class: 'tag' }, a.cooldown ? `CD ${a.cooldown}` : 'Basic')), h('div', { class: 'food-desc' }, a.desc));
            }),
          ),
        ),
      ),
      h(
        'div',
        { class: 'danger-zone' },
        h('p', { class: 'muted' }, `Releasing ${pet.name} returns them to the wild and deletes all progress.`),
        confirmButton(`Release ${pet.name}`, 'Click again to confirm', () => {
          resetGame({ keepPlayer: true });
          go('select');
        }),
      ),
    );
  }

  render();
  return { el };
}
