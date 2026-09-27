import { h } from '../dom.js';
import { go } from '../router.js';
import { game, adoptPet } from '../../core/state.js';
import { CONFIG } from '../../core/config.js';
import { SPECIES, SPECIES_ORDER } from '../../pets/species.js';
import { STAT_KEYS, STAT_LABELS } from '../../pets/pet.js';
import { ABILITIES } from '../../combat/abilities.js';
import { EXERCISES } from '../../training/exercises.js';
import { FOODS } from '../../foods/foods.js';
import { PetStage } from '../components/petStage.js';
import { createBar } from '../components/statBar.js';

// Used to scale the preview stat bars.
const STAT_MAX = { hp: 160, atk: 16, def: 12, spd: 17, crit: 0.25 };

let stages = [];

export default {
  mount(root) {
    if (!game.player) return go('title');
    let selected = null;

    const cards = SPECIES_ORDER.map((id) => {
      const sp = SPECIES[id];
      const stage = new PetStage({ width: 76, height: 68, label: sp.name });
      stage.addActor(id, { species: id, x: 38, y: 66 });
      stages.push(stage);
      const bars = STAT_KEYS.map((k) => {
        const bar = createBar({ label: STAT_LABELS[k], color: 'var(--c-yellow)', compact: true });
        bar.set(sp.base[k], STAT_MAX[k], k === 'crit' ? `${Math.round(sp.base[k] * 100)}%` : String(sp.base[k]));
        return bar.el;
      });
      const card = h(
        'button',
        { class: 'species-card', 'aria-pressed': 'false', onclick: () => choose(id) },
        h('div', { class: 'species-portrait' }, stage.canvas),
        h('h3', {}, sp.name),
        h('span', { class: 'tag' }, sp.role),
        h('p', { class: 'species-tagline' }, sp.tagline),
        h('div', { class: 'species-bars' }, bars),
      );
      return { id, card, stage };
    });

    const details = h('section', { class: 'panel species-details', 'aria-live': 'polite' }, h('p', { class: 'muted' }, 'Pick an animal above to see its abilities.'));
    const nameInput = h('input', { class: 'input', id: 'pet-name', maxLength: CONFIG.PET_NAME_MAX, placeholder: 'Pet name' });
    const adoptBtn = h('button', { class: 'btn btn-primary btn-big', type: 'submit', disabled: true }, 'Adopt');
    const form = h(
      'form',
      { class: 'panel adopt-panel', onsubmit: adopt },
      h('label', { class: 'field-label', for: 'pet-name' }, 'Name your pet'),
      h('div', { class: 'input-row' }, nameInput, adoptBtn),
    );

    function choose(id) {
      const prevDefault = selected && SPECIES[selected].defaultName;
      selected = id;
      const sp = SPECIES[id];
      for (const c of cards) {
        c.card.classList.toggle('is-selected', c.id === id);
        c.card.setAttribute('aria-pressed', String(c.id === id));
        if (c.id === id) c.stage.play(id, 'hop');
      }
      if (!nameInput.value || nameInput.value === prevDefault) nameInput.value = sp.defaultName;
      adoptBtn.disabled = false;
      adoptBtn.textContent = `Adopt ${sp.name}`;
      details.replaceChildren(
        h('h2', {}, `${sp.name}: ${sp.role}`),
        h('p', {}, sp.lore),
        h(
          'div',
          { class: 'stats-cols' },
          h(
            'ul',
            { class: 'ability-list' },
            sp.learnset.map(([level, aid]) => {
              const a = ABILITIES[aid];
              return h('li', {}, h('div', { class: 'ability-name' }, a.name, h('span', { class: 'tag' }, `Lv ${level}`), h('span', { class: 'tag' }, a.cooldown ? `CD ${a.cooldown}` : 'Basic')), h('div', { class: 'food-desc' }, a.desc));
            }),
          ),
          h(
            'ul',
            { class: 'plain-list' },
            h('li', {}, h('strong', {}, 'Passive: '), `${sp.passive.name}: ${sp.passive.desc}`),
            h('li', {}, h('strong', {}, 'Specialty: '), `${EXERCISES[sp.specialty].name} training (+50%)`),
            h('li', {}, h('strong', {}, 'Loves: '), sp.favoriteFoods.map((f) => FOODS[f].name).join(', ')),
            h('li', {}, h('strong', {}, 'Dislikes: '), sp.dislikedFoods.map((f) => FOODS[f].name).join(', ')),
          ),
        ),
      );
    }

    function adopt(e) {
      e.preventDefault();
      if (!selected) return;
      const name = nameInput.value.trim() || SPECIES[selected].defaultName;
      adoptPet(selected, name);
      go('home', { welcome: true });
    }

    root.append(
      h(
        'div',
        { class: 'screen select-screen' },
        h('header', { class: 'screen-head' }, h('h1', { class: 'h-small' }, 'Get an animal'), h('p', { class: 'muted' }, `Hi ${game.player.username}! Choose your companion. You'll raise, train and battle with them.`)),
        h('div', { class: 'species-grid' }, cards.map((c) => c.card)),
        details,
        form,
      ),
    );
  },

  unmount() {
    stages.forEach((s) => s.destroy());
    stages = [];
  },
};
