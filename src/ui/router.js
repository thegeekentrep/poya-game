/**
 * Screen router. A screen is { mount(root, params), unmount?(), tick?() }.
 */
let root = null;
let registry = {};
let current = null;

export function initRouter(rootEl, screens) {
  root = rootEl;
  registry = screens;
}

export function go(name, params = {}) {
  current?.unmount?.();
  root.replaceChildren();
  current = registry[name];
  if (!current) throw new Error(`Unknown screen: ${name}`);
  current.mount(root, params);
  window.scrollTo(0, 0);
}

export function tickScreen() {
  current?.tick?.();
}
