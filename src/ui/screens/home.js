/**
 * The camp: the pet, its needs, and the Care / Feed / Train / Battle / Stats tabs.
 */
import { h } from '../dom.js';
import { go } from '../router.js';
import { game, saveGame } from '../../core/state.js';
import { NEEDS, NEED_ORDER } from '../../pets/needs.js';
import { getMood, getThought, formatMoodMult } from '../../pets/mood.js';
import { getSpecies, xpToNext } from '../../pets/pet.js';
import { PetStage } from '../components/petStage.js';
import { createBar } from '../components/statBar.js';
import { createTopbar } from '../components/topbar.js';
import { toast } from '../components/toast.js';
import { createCarePanel } from '../panels/carePanel.js';
import { createFoodPanel } from '../panels/foodPanel.js';
import { createTrainPanel } from '../panels/trainPanel.js';
import { createBattlePanel } from '../panels/battlePanel.js';
import { createStatsPanel } from '../panels/statsPanel.js';

const TABS = [
  { id: 'care', label: 'Care', create: createCarePanel },
  { id: 'food', label: 'Feed', create: createFoodPanel },
  { id: 'train', label: 'Train', create: createTrainPanel },
  { id: 'battle', label: 'Battle', create: createBattlePanel },
  { id: 'stats', label: 'Stats', create: createStatsPanel },
];

// reaction -> [animation, emote]
const REACTIONS = {
  love: [null, 'heart'],
  eat: ['hop', 'heart'],
  happy: ['hop', 'note'],
  sparkle: ['hop', 'sparkle'],
  sleep: [null, null],
  angry: ['hurt', 'anger'],
  sad: [null, 'drop'],
  level: ['hop', 'star'],
};

let view = null;
let lastTab = 'care';

export default {
  mount(root, params = {}) {
    const pet = game.pet;
    if (!pet) return go('title');
    const sp = getSpecies(pet);

    const stage = new PetStage({ width: 128, height: 80, background: 'meadow', label: `${pet.name} the ${sp.name}` });
    stage.addActor('pet', { species: pet.species, x: 64, y: 72 });

    const topbar = createTopbar();
    const thought = h('div', { class: 'thought', 'aria-live': 'polite' });
    const nameEl = h('h2', { class: 'pet-name' });
    const metaEl = h('p', { class: 'pet-meta muted' });
    const moodChip = h('span', { class: 'chip' });
    const xpBar = createBar({ label: 'XP', color: 'var(--c-cyan)' });
    const needBars = Object.fromEntries(NEED_ORDER.map((id) => [id, createBar({ label: NEEDS[id].label, color: NEEDS[id].color, warnLow: true })]));
    const buffs = h('div', { class: 'chips' });

    const tabButtons = {};
    const tabBody = h('div', { class: 'tab-body', role: 'tabpanel' });
    const tabList = h(
      'div',
      { class: 'tabs', role: 'tablist' },
      TABS.map((t) => (tabButtons[t.id] = h('button', { class: 'tab', role: 'tab', onclick: () => { selectTab(t.id); revealTabBody(); } }, t.label))),
    );

    let panel = null;
    const ctx = {
      toast,
      refresh: () => refresh(),
      react: (kind) => react(kind),
      onLevelUp: (levels) => {
        if (!levels) return;
        toast(`Level up! ${pet.name} is now Lv ${pet.level}!`, 'good', 3500);
        react('level');
      },
    };

    function selectTab(id) {
      panel?.destroy?.();
      lastTab = id;
      for (const t of TABS) {
        tabButtons[t.id].classList.toggle('is-active', t.id === id);
        tabButtons[t.id].setAttribute('aria-selected', String(t.id === id));
      }
      panel = TABS.find((t) => t.id === id).create(ctx);
      tabBody.replaceChildren(panel.el);
    }

    // On phones the tab bar is pinned to the bottom, so scroll the panel into view.
    function revealTabBody() {
      if (!window.matchMedia('(max-width: 640px)').matches) return;
      const panelEl = tabBody.closest('.actions-panel');
      const top = panelEl.getBoundingClientRect().top;
      if (top > 80 || top < 0) panelEl.scrollIntoView({ block: 'start' });
    }

    function react(kind) {
      const [anim, emote] = REACTIONS[kind] || [];
      if (anim) stage.play('pet', anim);
      if (emote) stage.emote('pet', emote, 2);
    }

    function update() {
      const mood = getMood(pet);
      topbar.update();
      stage.setSleeping('pet', mood.id === 'sleeping');
      nameEl.textContent = pet.name;
      metaEl.textContent = `${sp.name} · ${sp.role} · Lv ${pet.level}`;
      moodChip.textContent = `Mood: ${mood.label} ${formatMoodMult(mood.mult)}`.trim();
      moodChip.style.setProperty('--chip', mood.color);
      thought.textContent = getThought(pet);
      xpBar.set(pet.xp, xpToNext(pet.level), `${pet.xp}/${xpToNext(pet.level)}`);
      for (const id of NEED_ORDER) needBars[id].set(pet.needs[id]);
      buffs.replaceChildren(...(pet.buffs.trainingBoost ? [h('span', { class: 'chip', style: { '--chip': 'var(--c-light)' } }, 'Protein boost')] : []));
    }

    function refresh() {
      update();
      panel?.update?.();
      saveGame();
    }

    root.append(
      h(
        'div',
        { class: 'screen home-screen' },
        topbar.el,
        h(
          'div',
          { class: 'home-grid' },
          h(
            'section',
            { class: 'panel pet-panel' },
            h('div', { class: 'stage-frame' }, stage.canvas, thought),
            h('div', { class: 'pet-heading' }, h('div', {}, nameEl, metaEl), moodChip),
            xpBar.el,
          ),
          h('section', { class: 'panel needs-panel', 'aria-label': 'Needs' }, h('h3', {}, 'Needs'), NEED_ORDER.map((id) => needBars[id].el), buffs),
          h('section', { class: 'panel actions-panel' }, tabList, tabBody),
        ),
      ),
    );

    selectTab(params.tab || lastTab);
    update();
    if (params.welcome) {
      toast(`Welcome home, ${pet.name}!`, 'good', 3500);
      react('love');
    }

    view = {
      tick: () => {
        update();
        panel?.update?.();
      },
      destroy: () => {
        panel?.destroy?.();
        stage.destroy();
      },
    };
  },

  tick() {
    view?.tick();
  },

  unmount() {
    view?.destroy();
    view = null;
  },
};
