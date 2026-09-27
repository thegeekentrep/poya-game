import { h } from '../dom.js';
import { game } from '../../core/state.js';
import { CONFIG } from '../../core/config.js';
import { createSoundToggles } from './soundToggles.js';

export function createTopbar() {
  const user = h('span', { class: 'tb-item tb-user' });
  const coins = h('span', { class: 'tb-item tb-coins' });
  const trophies = h('span', { class: 'tb-item tb-trophies', title: 'Trophies' });
  const record = h('span', { class: 'tb-item tb-record' });
  const el = h('header', { class: 'topbar' }, h('div', { class: 'brand' }, CONFIG.GAME_TITLE), h('div', { class: 'tb-stats' }, user, coins, trophies, record), createSoundToggles());

  function update() {
    user.textContent = `@${game.player?.username ?? 'guest'}`;
    coins.textContent = `${game.coins}c`;
    trophies.textContent = String(game.record.trophies);
    record.textContent = `${game.record.wins}W ${game.record.losses}L`;
  }
  update();
  return { el, update };
}
