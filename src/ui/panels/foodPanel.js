import { h } from '../dom.js';
import { game } from '../../core/state.js';
import { FOODS, FOOD_ORDER } from '../../foods/foods.js';
import { buyFood, feedPet, foodPreference, describeEffects } from '../../foods/feeding.js';
import { playSfx } from '../../audio/sfx.js';

const FEED_SFX = { favorite: 'yum', neutral: 'eat', disliked: 'yuck' };

const PREF_TAG = { favorite: '★ Favorite', disliked: '✗ Dislikes', neutral: '' };

export function createFoodPanel(ctx) {
  const refs = {};
  const rows = FOOD_ORDER.map((id) => {
    const food = FOODS[id];
    const pref = foodPreference(game.pet, id);
    const owned = h('span', { class: 'food-owned' });
    const feedBtn = h('button', { class: 'btn btn-small', onclick: () => feed(id) }, 'Feed');
    const buyBtn = h('button', { class: 'btn btn-small btn-ghost', onclick: () => buy(id) }, `Buy ${food.price}c`);
    refs[id] = { owned, feedBtn, buyBtn };
    return h(
      'li',
      { class: 'food-row' },
      h('span', { class: 'food-swatch', style: { '--swatch': food.color }, 'aria-hidden': 'true' }),
      h(
        'div',
        { class: 'food-info' },
        h('div', { class: 'food-name' }, food.name, PREF_TAG[pref] && h('span', { class: `tag tag--${pref}` }, PREF_TAG[pref])),
        h('div', { class: 'food-desc' }, `${describeEffects(food.effects)}. ${food.desc}`),
      ),
      owned,
      h('div', { class: 'food-actions' }, feedBtn, buyBtn),
    );
  });

  function feed(id) {
    const res = feedPet(game, id);
    playSfx(!res.ok ? 'error' : FOODS[id].medicine ? 'medicine' : FEED_SFX[res.preference]);
    act(res);
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

  const el = h('div', {}, h('p', { class: 'panel-note' }, 'Buy food with coins earned in the arena. Every species has favorites.'), h('ul', { class: 'food-list' }, rows));

  function update() {
    for (const id of FOOD_ORDER) {
      const count = game.inventory[id] || 0;
      refs[id].owned.textContent = `×${count}`;
      refs[id].feedBtn.disabled = count <= 0;
      refs[id].buyBtn.disabled = game.coins < FOODS[id].price;
    }
  }

  update();
  return { el, update };
}
