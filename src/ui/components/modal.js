import { h } from '../dom.js';

/** Opens a modal dialog. Returns { close }. */
export function openModal(content, { label = 'Dialog', onClose } = {}) {
  const box = h('div', { class: 'modal panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': label }, content);
  const backdrop = h('div', { class: 'modal-backdrop' }, box);
  const previouslyFocused = document.activeElement;
  document.body.append(backdrop);
  box.querySelector('button, input')?.focus();

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    backdrop.remove();
    previouslyFocused?.focus?.();
    onClose?.();
  }
  return { close, el: box };
}

/** A button that needs two clicks: first arms it, second confirms. */
export function confirmButton(label, confirmLabel, onConfirm, className = 'btn btn-danger') {
  let armed = false;
  let timer = 0;
  const btn = h('button', {
    class: className,
    onclick: () => {
      if (armed) {
        clearTimeout(timer);
        onConfirm();
        return;
      }
      armed = true;
      btn.textContent = confirmLabel;
      btn.classList.add('is-armed');
      timer = setTimeout(() => {
        armed = false;
        btn.textContent = label;
        btn.classList.remove('is-armed');
      }, 3000);
    },
  }, label);
  return btn;
}
