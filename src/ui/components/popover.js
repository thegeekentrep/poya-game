/**
 * A small details card that pops up next to a tile (above it if there's room,
 * otherwise below), with a pointer towards it. Closes on ✕, Escape or a tap elsewhere.
 * Used by the Feed and Train tabs.
 */
import { h } from '../dom.js';

/**
 * container: a position: relative element the card is placed in.
 * Call open(key, anchor, render) where render() returns the card's content;
 * refresh() re-renders the open card (e.g. after counts change).
 */
export function createPopover(container) {
  const el = h('div', { class: 'popover', role: 'dialog', hidden: true });
  let key = null;
  let anchor = null;
  let render = null;

  function draw() {
    el.replaceChildren(h('button', { class: 'popover-close', 'aria-label': 'Close', onclick: close }, '✕'), ...[render()].flat().filter(Boolean));
  }

  function place() {
    const box = container.getBoundingClientRect();
    const tile = anchor.getBoundingClientRect();
    const left = Math.min(Math.max(0, tile.left - box.left + tile.width / 2 - el.offsetWidth / 2), box.width - el.offsetWidth);
    const useAbove = tile.top - el.offsetHeight - 6 > 0; // the panel sits at the bottom of the screen on phones
    el.style.left = `${left}px`;
    el.style.top = `${useAbove ? tile.top - box.top - el.offsetHeight - 6 : tile.bottom - box.top + 6}px`;
    el.style.setProperty('--arrow-x', `${tile.left - box.left + tile.width / 2 - left}px`);
    el.classList.toggle('is-below', !useAbove);
  }

  function open(newKey, newAnchor, newRender, label = '') {
    key = newKey;
    anchor = newAnchor;
    render = newRender;
    el.setAttribute('aria-label', label);
    draw();
    el.hidden = false;
    place();
    el.querySelector('.btn')?.focus({ preventScroll: true });
  }

  function close() {
    if (key == null) return;
    key = null;
    el.hidden = true;
    if (el.contains(document.activeElement)) anchor?.focus({ preventScroll: true });
  }

  /** Opens for this key, or closes if it's already open for it. */
  function toggle(newKey, newAnchor, newRender, label) {
    if (key === newKey) close();
    else open(newKey, newAnchor, newRender, label);
  }

  function refresh() {
    if (key == null) return;
    draw();
    place();
  }

  const onOutside = (e) => {
    if (key != null && !el.contains(e.target) && !anchor?.contains(e.target)) close();
  };
  const onKey = (e) => e.key === 'Escape' && close();
  document.addEventListener('pointerdown', onOutside);
  document.addEventListener('keydown', onKey);

  function destroy() {
    document.removeEventListener('pointerdown', onOutside);
    document.removeEventListener('keydown', onKey);
  }

  return { el, open, close, toggle, refresh, destroy, get key() { return key; } };
}
