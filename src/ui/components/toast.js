import { h } from '../dom.js';

const MAX_TOASTS = 4;
let host = null;

/** tone: info | good | warn | bad */
export function toast(message, tone = 'info', ms = 2600) {
  if (!host) {
    host = h('div', { class: 'toast-host', role: 'status', 'aria-live': 'polite' });
    document.body.append(host);
  }
  const el = h('div', { class: `toast toast--${tone}` }, message);
  host.append(el);
  while (host.children.length > MAX_TOASTS) host.firstChild.remove();
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 250);
  }, ms);
}
