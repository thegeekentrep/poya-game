import { h } from '../dom.js';
import { isEnabled, setEnabled } from '../../audio/audio.js';

/** "Music" and "SFX" on/off buttons. The choice is remembered between visits. */
export function createSoundToggles() {
  const toggle = (bus, label) => {
    const btn = h('button', { class: 'btn btn-ghost btn-small sound-toggle', title: `Turn ${label.toLowerCase()} on or off` }, label);
    const sync = () => {
      btn.setAttribute('aria-pressed', String(isEnabled(bus)));
      btn.classList.toggle('is-off', !isEnabled(bus));
    };
    btn.addEventListener('click', () => {
      setEnabled(bus, !isEnabled(bus));
      sync();
    });
    sync();
    return btn;
  };
  return h('div', { class: 'sound-toggles', role: 'group', 'aria-label': 'Sound' }, toggle('music', 'Music'), toggle('sfx', 'SFX'));
}
