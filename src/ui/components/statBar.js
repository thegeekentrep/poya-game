import { h } from '../dom.js';
import { clamp } from '../../core/utils.js';

/** A labelled, segmented pixel bar. Call .set(value, max, text) to update. */
export function createBar({ label, color, compact = false, warnLow = false }) {
  const fill = h('div', { class: 'bar__fill' });
  const value = h('span', { class: 'bar-value' });
  const track = h('div', { class: 'bar', style: { '--fill': color }, role: 'meter', 'aria-label': label, 'aria-valuemin': '0' }, fill);
  const el = h('div', { class: `bar-row${compact ? ' bar-row--compact' : ''}` }, h('div', { class: 'bar-head' }, h('span', { class: 'bar-label' }, label), value), track);

  function set(v, max = 100, text) {
    const pct = clamp(max > 0 ? v / max : 0, 0, 1);
    fill.style.width = `${pct * 100}%`;
    value.textContent = text ?? String(Math.round(v));
    track.setAttribute('aria-valuemax', String(max));
    track.setAttribute('aria-valuenow', String(Math.round(v)));
    el.classList.toggle('is-low', warnLow && pct < 0.25);
  }

  return { el, set };
}
