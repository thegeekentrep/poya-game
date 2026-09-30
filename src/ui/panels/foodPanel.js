import { h } from '../dom.js';
import { game } from '../../core/state.js';
import { FOODS, FOOD_ORDER } from '../../foods/foods.js';
import { buyFood, feedPet, foodPreference, describeEffects, feedEffects } from '../../foods/feeding.js';
import { playSfx } from '../../audio/sfx.js';
import { FOOD_SPRITES } from '../../sprites/foods.js';
import { spriteCanvas } from '../../sprites/renderer.js';
import { createPopover } from '../components/popover.js';

const PREF_TAG = { favorite: '★ Favorite', disliked: '✗ Dislikes', neutral: '' };
const PREF_MARK = { favorite: '★', disliked: '✗', neutral: '' };
const ICON_SCALE = 3;

/** The food's pixel sprite as a small canvas. */
const foodIcon = (id) => spriteCanvas(FOOD_SPRITES[id], ICON_SCALE, 'food-icon');

const PREF_LINE = {
  favorite: (pet) => `★ ${pet.name}'s favorite! Extra filling, and it lifts their mood.`,
  disliked: (pet) => `✗ ${pet.name} dislikes this. Less filling, and it sours their mood.`,
  neutral: (pet) => `${pet.name} doesn't mind it.`,
};

export function createFoodPanel(ctx) {
  const refs = {};
  const el = h('div', { class: 'food-panel' });
  const pop = createPopover(el); // the details card
  const rows = FOOD_ORDER.map((id) => {
    const food = FOODS[id];
    const pref = foodPreference(game.pet, id);
    const owned = h('span', { class: 'food-owned' });
    const feedBtn = h('button', { class: 'btn btn-small', onclick: () => feed(id) }, 'Feed');
    const buyBtn = h('button', { class: 'btn btn-small btn-ghost', onclick: () => buy(id) }, h('span', { class: 'buy-word' }, 'Buy '), `${food.price}c`);
    // the picture (the whole tile on phones) opens a little card with the details
    const iconBtn = h(
      'button',
      { class: 'food-icon-btn', 'aria-label': `${food.name}: details`, 'aria-haspopup': 'dialog', onclick: () => togglePop(id) },
      foodIcon(id),
      PREF_MARK[pref] && h('span', { class: `food-mark food-mark--${pref}`, 'aria-hidden': 'true' }, PREF_MARK[pref]),
      h('span', { class: 'food-title' }, food.short),
    );
    refs[id] = { owned, feedBtn, buyBtn, iconBtn };
    const row = h(
      'li',
      { class: 'food-row' },
      iconBtn,
      h(
        'div',
        { class: 'food-info' },
        h('div', { class: 'food-name' }, food.name, PREF_TAG[pref] && h('span', { class: `tag tag--${pref}` }, PREF_TAG[pref])),
        h('div', { class: 'food-desc' }, `${describeEffects(food.effects)}. ${food.desc}`),
      ),
      owned,
      h('div', { class: 'food-actions' }, feedBtn, buyBtn),
    );
    refs[id].row = row;
    return row;
  });

  // ── the details card ──
  function popContent(id) {
    const food = FOODS[id];
    const pet = game.pet;
    const pref = foodPreference(pet, id);
    const count = game.inventory[id] || 0;
    return [
      h('div', { class: 'popover-head' }, foodIcon(id), h('strong', {}, food.name)),
      h('p', { class: `food-pop-pref food-pop-pref--${pref}` }, PREF_LINE[pref](pet)),
      h('p', { class: 'popover-muted' }, food.desc),
      h('p', { class: 'popover-fx' }, `${pet.name} gets: ${describeEffects(feedEffects(pet, id))}`),
      h(
        'div',
        { class: 'popover-actions' },
        h('button', { class: 'btn btn-small btn-primary', disabled: count <= 0, onclick: () => { pop.close(); feed(id); } }, `Feed (×${count})`),
        h('button', { class: 'btn btn-small btn-ghost', disabled: game.coins < food.price, onclick: () => buy(id) }, `Buy ${food.price}c`),
      ),
    ];
  }

  function togglePop(id) {
    // anchored to the whole tile on phones, the picture on desktop
    pop.toggle(id, refs[id].iconBtn, () => popContent(id), FOODS[id].name);
  }

  function feed(id) {
    const res = feedPet(game, id);
    const outcome = res.ok ? (FOODS[id].medicine ? 'medicine' : res.preference) : res.reaction === 'sad' ? 'refuse' : null;
    if (outcome) {
      ctx.feed(id, outcome); // animation + sounds
      ctx.toast(res.message, res.ok ? 'good' : 'warn');
      ctx.refresh();
    } else {
      playSfx('error');
      act(res);
    }
  }

  function buy(id) {
    const res = buyFood(game, id);
    playSfx(res.ok ? 'coin' : 'error');
    act(res);
  }

  function act(res) {
    ctx.toast(res.message, res.ok ? 'good' : 'warn');
    if (res.reaction) ctx.react(res.reaction);
    ctx.refresh();
  }

  el.append(
    h(
      'p',
      { class: 'panel-note food-note' },
      h('span', { class: 'hint-long' }, 'Buy food with coins earned by training or in the arena. Every species has favorites. Click a picture for details.'),
      h('span', { class: 'hint-short' }, `Tap a food to see what it does and if ${game.pet.name} likes it.`),
    ),
    h('ul', { class: 'food-list' }, rows),
    pop.el,
  );

  function update() {
    for (const id of FOOD_ORDER) {
      const count = game.inventory[id] || 0;
      refs[id].owned.textContent = `×${count}`;
      refs[id].feedBtn.disabled = count <= 0;
      refs[id].row.classList.toggle('is-empty', count <= 0);
      refs[id].buyBtn.disabled = game.coins < FOODS[id].price;
    }
    pop.refresh();
  }

  update();
  return { el, update, destroy: pop.destroy };
}
