/**
 * Screen router. A screen is { mount(root, params), unmount?(), tick?() }.
 */
let root = null;
let registry = {};
let current = null;
let onChange = null;

export function initRouter(rootEl, screens, { onNavigate } = {}) {
  root = rootEl;
  registry = screens;
  onChange = onNavigate;
}

export function go(name, params = {}) {
  current?.unmount?.();
  root.replaceChildren();
  current = registry[name];
  if (!current) throw new Error(`Unknown screen: ${name}`);
  onChange?.(name);
  current.mount(root, params);
  window.scrollTo(0, 0);
}

export function tickScreen() {
  current?.tick?.();
}
