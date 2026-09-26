import { h } from '../dom.js';
import { game } from '../../core/state.js';
import { CARE_ACTIONS, CARE_ORDER, careCooldownLeft, performCare } from '../../care/care.js';
import { isAsleep } from '../../pets/needs.js';

export function createCarePanel(ctx) {
  const refs = {};
  const el = h(
    'div',
    { class: 'card-grid' },
    CARE_ORDER.map((id) => {
      const action = CARE_ACTIONS[id];
      const title = h('span', { class: 'action-title' }, action.label);
      const status = h('span', { class: 'action-status' });
      const btn = h(
        'button',
        {
          class: 'action-card',
          onclick: () => {
            const res = performCare(game.pet, id);
            ctx.toast(res.message, res.ok ? 'good' : 'warn');
            if (res.ok) ctx.react(res.reaction);
            ctx.refresh();
          },
        },
        title,
        h('span', { class: 'action-desc' }, action.desc),
        status,
      );
      refs[id] = { btn, title, status };
      return btn;
    }),
  );

  function update() {
    const pet = game.pet;
    const asleep = isAsleep(pet);
    for (const id of CARE_ORDER) {
      const { btn, title, status } = refs[id];
      const left = careCooldownLeft(pet, id);
      const isWake = id === 'sleep' && asleep;
      title.textContent = isWake ? 'Wake up' : CARE_ACTIONS[id].label;
      btn.disabled = asleep ? !isWake : left > 0;
      status.textContent = isWake ? 'Sleeping...' : asleep ? 'Asleep' : left > 0 ? `Ready in ${left}s` : 'Ready';
    }
  }

  update();
  return { el, update };
}
