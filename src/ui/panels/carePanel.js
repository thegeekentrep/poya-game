import { h } from '../dom.js';
import { game } from '../../core/state.js';
import { CARE_ACTIONS, CARE_ORDER, careCooldownLeft, performCare, checkCare } from '../../care/care.js';
import { openGroomModal } from '../components/groomModal.js';
import { openPlayModal } from '../components/playModal.js';

// care actions played as mini-games; they call back with a quality of 0..1
const MINI_GAMES = { groom: openGroomModal, play: openPlayModal };
import { isAsleep } from '../../pets/needs.js';

export function createCarePanel(ctx) {
  const refs = {};
  const grid = h(
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
            if (!MINI_GAMES[id]) return apply(id, 1);
            const check = checkCare(game.pet, id);
            if (!check.ok) return ctx.toast(check.message, 'warn');
            MINI_GAMES[id]({
              pet: game.pet,
              onComplete: (quality) => (quality > 0 ? apply(id, quality) : ctx.toast('Maybe later.', 'warn')),
            });
          },
        },
        title,
        h('span', { class: 'action-desc' }, action.desc),
        h('span', { class: 'action-short' }, action.short), // phones
        status,
      );
      refs[id] = { btn, title, status };
      return btn;
    }),
  );
  const el = h('div', {}, h(
    'p',
    { class: 'panel-note care-hint' },
    h('span', { class: 'hint-long' }, `Tap ${game.pet.name} to cuddle. Gentle taps make them happy; too many at once and they'll get annoyed.`),
    h('span', { class: 'hint-short' }, `Tap ${game.pet.name} to cuddle, but not too much!`),
  ), grid);

  function apply(id, quality) {
    const res = performCare(game.pet, id, Date.now(), quality);
    ctx.toast(res.message, res.ok ? 'good' : 'warn');
    if (res.ok) ctx.react(res.reaction);
    ctx.refresh();
  }

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
