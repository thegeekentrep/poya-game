import { h } from '../dom.js';
import { go } from '../router.js';
import { game, setPlayer, resetGame } from '../../core/state.js';
import { CONFIG } from '../../core/config.js';
import { SPECIES, SPECIES_ORDER } from '../../pets/species.js';
import { PetStage } from '../components/petStage.js';
import { SPRITES } from '../../sprites/animals.js';
import { spriteSize } from '../../sprites/renderer.js';
import { confirmButton } from '../components/modal.js';
import { pick } from '../../core/utils.js';

const DESCRIPTION =
  'POYA is a pixelated digital pet you raise like a real one. Adopt a wild animal, keep it fed, clean and happy, ' +
  'condition it in the training yard, then send it into the arena to battle rival pets.';

// [title, full text (desktop), one-liner (phone tiles)]
const FEATURES = [
  ['Care', 'Feed, brush, play and cuddle. Your pet gets hungry, tired and dirty, and its mood changes. Neglect it and it gets sick.', 'Feed, brush, play & cuddle'],
  ['Train', 'Six Digimon-style stations raise its stats. Master them, and level up, to learn new moves.', '6 stations, new moves'],
  ['Battle', 'Turn-based fights against mystery rivals, with each species using its own tactics.', 'Fight mystery rivals'],
];

let stage = null;
let hopTimer = 0;

export default {
  mount(root) {
    // line the animals up side by side, 8px apart
    const widths = SPECIES_ORDER.map((id) => spriteSize(SPRITES[id]).w);
    stage = new PetStage({ width: widths.reduce((a, b) => a + b + 8, 8), height: 72, background: 'meadow', label: 'Wolf, Gorilla, Grizzly Bear and Eagle' });
    let left = 8;
    SPECIES_ORDER.forEach((id, i) => {
      stage.addActor(id, { species: id, x: left + widths[i] / 2, y: 68 });
      left += widths[i] + 8;
    });
    hopTimer = setInterval(() => {
      const id = pick(SPECIES_ORDER);
      stage.play(id, 'hop');
      if (Math.random() < 0.4) stage.emote(id, 'note');
    }, 1400);

    const hasPet = Boolean(game.pet && game.player);
    root.append(
      h(
        'div',
        { class: 'screen title-screen' },
        h('header', { class: 'logo' }, h('h1', {}, CONFIG.GAME_TITLE), h('p', { class: 'subtitle' }, CONFIG.GAME_SUBTITLE)),
        h('div', { class: 'stage-frame' }, stage.canvas),
        hasPet ? continueBlock() : newPlayerBlock(),
        h(
          'section',
          { class: 'panel about' },
          h('h2', {}, 'About the game'),
          h('p', { class: 'about-desc' }, DESCRIPTION),
          h('ul', { class: 'feature-list' }, FEATURES.map(([t, d, short]) => h('li', {}, h('strong', {}, t), ' ', h('span', { class: 'feature-long' }, d), h('span', { class: 'feature-short' }, short)))),
          h('p', { class: 'muted about-species' }, `Choose from ${SPECIES_ORDER.map((id) => SPECIES[id].name).join(', ')}.`),
        ),
      ),
    );
  },

  unmount() {
    clearInterval(hopTimer);
    stage?.destroy();
    stage = null;
  },
};

function continueBlock() {
  const pet = game.pet;
  return h(
    'section',
    { class: 'panel start-panel' },
    h('h2', {}, `Welcome back, ${game.player.username}!`),
    h('p', {}, `${pet.name} the ${SPECIES[pet.species].name} (Lv ${pet.level}) is waiting for you.`),
    h(
      'div',
      { class: 'btn-row' },
      h('button', { class: 'btn btn-primary btn-big', onclick: () => go('home') }, 'Continue ▶'),
      confirmButton('Start over', 'Erase save?', () => {
        resetGame();
        go('title');
      }),
    ),
  );
}

function newPlayerBlock() {
  const { USERNAME_MIN: min, USERNAME_MAX: max } = CONFIG;
  const input = h('input', {
    class: 'input',
    id: 'username',
    maxLength: max,
    placeholder: 'e.g. beastmaster',
    autocomplete: 'nickname',
    value: game.player?.username ?? '',
  });
  const error = h('p', { class: 'error', 'aria-live': 'polite' });

  function submit(e) {
    e.preventDefault();
    const name = input.value.trim();
    if (name.length < min) return (error.textContent = `Username needs at least ${min} characters.`);
    if (!/^[\w .-]+$/.test(name)) return (error.textContent = 'Use letters, numbers, spaces, . - or _ only.');
    setPlayer(name);
    go('select');
  }

  return h(
    'form',
    { class: 'panel start-panel', onsubmit: submit },
    h('label', { class: 'field-label', for: 'username' }, 'Username'),
    h('div', { class: 'input-row' }, input, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Get an animal ▶')),
    error,
  );
}
