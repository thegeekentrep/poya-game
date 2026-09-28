/**
 * The training UI. Pick a difficulty, then play the station's mini-game:
 * a swipe pad for Boulder, Waterfall and Running, left / right buttons for the
 * Log (chop) and the Glove (block), or a math quiz for the Classroom.
 * Game logic lives in training/games.js, logChop.js, gloveBlock.js and
 * mathQuiz.js; stat results in training/trainer.js.
 */
import { h } from '../dom.js';
import { openModal } from './modal.js';
import { PetStage } from './petStage.js';
import { GESTURE_GAMES, GAME_HINTS, gameIntensity } from '../../training/games.js';
import { MathQuiz } from '../../training/mathQuiz.js';
import { LogChopGame } from '../../training/logChop.js';
import { GloveGame } from '../../training/gloveBlock.js';
import { EXERCISES, TRAINING_DIFFICULTY, DIFFICULTY_ORDER } from '../../training/exercises.js';
import { createTrainingScene, SCENE_SIZE } from './trainingScenes.js';
import { completeTraining, mastery, learnTrainingMove } from '../../training/trainer.js';
import { ABILITIES } from '../../combat/abilities.js';
import { STAT_LABELS, formatStat } from '../../pets/pet.js';
import { game as save } from '../../core/state.js';
import { learnedLine } from '../moveText.js';
import { playSfx } from '../../audio/sfx.js';

const GRADE_SFX = { perfect: 'perfect', good: 'good', miss: 'bad' };
const CHECKPOINT_LABELS = { perfect: 'PERFECT!', good: 'Good', miss: 'Miss...' };
const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space', 'Enter'];
const STATION_GAMES = { ...GESTURE_GAMES, log: LogChopGame, glove: GloveGame, classroom: MathQuiz };
const HINTS = {
  ...GAME_HINTS,
  log: 'Tap the left or right side to chop from that side. Dodge the branches as the log drops! (Arrow keys work too.)',
  glove: 'Watch for the flashing machine and block on that side just before the glove lands. Late blocks are PERFECT parries! (Arrow keys work too.)',
  classroom: 'Solve each equation before time runs out. Quick right answers are PERFECT! (Keys 1–4 pick an answer.)',
};

const rewardText = (id) => {
  const { reward } = TRAINING_DIFFICULTY[id];
  return reward === 1 ? 'Normal gains' : `Gains ×${reward}`;
};

export function openTrainingModal({ pet, exerciseId, onComplete }) {
  const ex = EXERCISES[exerciseId];
  const load = mastery(pet, exerciseId).tier;
  const Game = STATION_GAMES[exerciseId];
  let difficulty = TRAINING_DIFFICULTY[save.trainingDifficulty] ? save.trainingDifficulty : 'normal';

  const stage = new PetStage({ ...SCENE_SIZE, label: `${pet.name} training at the ${ex.name}` });
  let sim = null; // the station's game, created on Start
  let scene = createTrainingScene(exerciseId, stage, pet.species, new Game()); // preview

  const play = h('div', { class: 'sim-play' });
  const pips = h('div', { class: 'sim-pips' });
  const feedback = h('p', { class: 'sim-feedback', 'aria-live': 'polite' });
  const actions = h('div', { class: 'btn-row' });
  const body = h(
    'div',
    { class: 'training-sim' },
    h('h2', {}, `${ex.name} training`),
    h('p', { class: 'muted train-desc' }, ex.desc, load ? ` Overload Lv ${load}: it gets tougher.` : ''),
    h('div', { class: 'stage-frame' }, stage.canvas),
    play,
    pips,
    feedback,
    actions,
  );

  let raf = 0;
  let last = 0;
  let result = null;
  let seen = 0; // grades already shown
  let falls = 0;
  let onFrame = () => {};

  // ── Difficulty picker ──────────────────────────────────────────
  function showPicker() {
    const note = h('p', { class: 'muted diff-note' });
    const buttons = DIFFICULTY_ORDER.map((id) =>
      h('button', { class: 'seg', type: 'button', 'aria-pressed': 'false', onclick: () => choose(id) }, TRAINING_DIFFICULTY[id].name),
    );
    function choose(id) {
      difficulty = id;
      buttons.forEach((b, i) => {
        const on = DIFFICULTY_ORDER[i] === id;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      note.textContent = `${rewardText(id)}, XP and mastery.`;
    }
    choose(difficulty);
    play.replaceChildren(h('div', { class: 'seg-group diff-picker', role: 'group', 'aria-label': 'Difficulty' }, buttons), note);
    feedback.textContent = HINTS[exerciseId];
    actions.replaceChildren(
      h('button', { class: 'btn btn-primary btn-big', onclick: start }, 'Start!'),
      h('button', { class: 'btn btn-ghost', onclick: () => modal.close() }, 'Cancel'),
    );
  }

  function start() {
    save.trainingDifficulty = difficulty;
    sim = new Game({ intensity: gameIntensity(difficulty, load) });
    // rebuild the scene around the real game
    stage.actors.clear();
    stage.effects = [];
    stage.particles = [];
    scene = createTrainingScene(exerciseId, stage, pet.species, sim);
    pips.replaceChildren(...Array.from({ length: sim.reps }, () => h('span', { class: 'sim-pip' })));
    feedback.textContent = '';
    delete feedback.dataset.grade;
    if (exerciseId === 'classroom') buildQuiz();
    else if (exerciseId === 'log') buildSidePad(LOG_PAD);
    else if (exerciseId === 'glove') buildSidePad(GLOVE_PAD);
    else buildPad();
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  // ── Swipe pad (Boulder, Waterfall, Running) ────────────────────
  function buildPad() {
    const balance = exerciseId === 'waterfall';
    const fill = h('div', { class: 'game-meter-fill' });
    const needle = h('div', { class: 'game-meter-needle' });
    const meter = h(
      'div',
      { class: `game-meter ${balance ? 'game-meter--balance' : ''}`, 'aria-hidden': 'true' },
      balance ? [h('div', { class: 'game-meter-safe' }), needle] : [fill, h('i', { style: { left: '33.3%' } }), h('i', { style: { left: '66.6%' } })],
    );
    const clock = h('span', { class: 'game-clock' });
    const status = h('span', { class: 'game-status' });
    const pad = h(
      'div',
      { class: `swipe-pad ${balance ? 'swipe-pad--balance' : ''}`, role: 'application', 'aria-label': GAME_HINTS[exerciseId] },
      balance ? [h('span', {}, '<< lean'), h('span', {}, 'lean >>')] : h('span', {}, exerciseId === 'boulder' ? 'swipe >>>' : '<< swipe swipe >>'),
    );

    let held = null; // { id, x, y }
    const where = (e) => {
      const r = pad.getBoundingClientRect();
      return { w: r.width || 1, x: ((e.clientX - r.left) / (r.width || 1)) * 2 - 1 };
    };
    pad.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      pad.setPointerCapture?.(e.pointerId);
      held = { id: e.pointerId, x: e.clientX, y: e.clientY };
      sim.drag({ dx: 0, dy: 0, x: where(e).x });
    });
    pad.addEventListener('pointermove', (e) => {
      if (!held || e.pointerId !== held.id) return;
      const { w, x } = where(e);
      sim.drag({ dx: (e.clientX - held.x) / w, dy: (e.clientY - held.y) / w, x });
      held.x = e.clientX;
      held.y = e.clientY;
    });
    const letGo = (e) => {
      if (!held || e.pointerId !== held.id) return;
      held = null;
      sim.release();
    };
    pad.addEventListener('pointerup', letGo);
    pad.addEventListener('pointercancel', letGo);

    play.replaceChildren(h('div', { class: 'game-hud' }, status, clock), meter, pad);
    actions.replaceChildren(h('button', { class: 'btn btn-ghost', onclick: () => modal.close() }, 'Cancel'));
    onFrame = () => {
      clock.textContent = `${sim.timeLeft.toFixed(1)}s`;
      clock.classList.toggle('is-low', sim.timeLeft < 3);
      if (balance) {
        needle.style.left = `${((sim.tilt + 1) / 2) * 100}%`;
        meter.classList.toggle('is-danger', Math.abs(sim.tilt) > 0.7);
        status.textContent = sim.fallen ? 'Slipped!' : Math.abs(sim.tilt) > 0.7 ? 'Careful!' : 'Steady…';
        if (sim.falls > falls) {
          falls = sim.falls;
          scene.fall();
          playSfx('bad');
        }
      } else {
        fill.style.width = `${sim.pos * 100}%`;
        status.textContent = `${Math.round(sim.pos * 100)}%`;
      }
    };
    keyHandler = (e, down) => {
      if (!GAME_KEYS.includes(e.code)) return;
      e.preventDefault();
      if (down && e.repeat && exerciseId !== 'waterfall') return; // no autofire
      sim.key(e.code, down);
    };
  }

  // ── Left / right buttons (Striking Log, Punch Glove) ───────────
  // Each pad: the button verb, what a press does, the status line, and sounds for new events.
  const LOG_PAD = {
    verb: 'CHOP',
    press: (side) => sim.chop(side),
    status: () => (sim.stunned ? 'Bonk! Dazed...' : `Chopped ${sim.chopped} / ${sim.total}`),
    sounds: (() => {
      let chops = 0;
      let bonks = 0;
      return () => {
        if (sim.chopped > chops) playSfx('chomp'); // a short thwack
        if (sim.bonks > bonks) playSfx('hit');
        chops = sim.chopped;
        bonks = sim.bonks;
      };
    })(),
  };
  const GLOVE_PAD = {
    verb: 'BLOCK',
    press: (side) => sim.block(side),
    status: () => {
      const last = sim.last && sim.time - sim.last.time < 0.6 ? sim.last.outcome : null;
      return last === 'parry' ? 'Parry!' : last === 'block' ? 'Blocked!' : last === 'hit' ? 'Ouch!' : `Punch ${Math.min(sim.resolved + 1, sim.total)} / ${sim.total}`;
    },
    sounds: (() => {
      let seen = 0;
      return () => {
        if (sim.resolved > seen) playSfx({ hit: 'hit', block: 'chomp', parry: 'good' }[sim.last.outcome]);
        seen = sim.resolved;
      };
    })(),
  };

  function buildSidePad({ verb, press, status, sounds }) {
    const fill = h('div', { class: 'game-meter-fill' });
    const clock = h('span', { class: 'game-clock' });
    const line = h('span', { class: 'game-status' });
    const side = (s, label) =>
      h('button', {
        class: `chop-side chop-side--${s}`,
        type: 'button',
        'aria-label': `${verb.toLowerCase()} on the ${s === 'L' ? 'left' : 'right'}`,
        onpointerdown: (e) => {
          e.preventDefault();
          press(s);
        },
        // keyboard / assistive activation (pointer taps are handled on pointerdown)
        onclick: (e) => e.detail === 0 && press(s),
      }, label);
    play.replaceChildren(
      h('div', { class: 'game-hud' }, line, clock),
      h('div', { class: 'game-meter', 'aria-hidden': 'true' }, fill, h('i', { style: { left: '33.3%' } }), h('i', { style: { left: '66.6%' } })),
      h('div', { class: 'chop-pad' }, side('L', `<< ${verb}`), side('R', `${verb} >>`)),
    );
    actions.replaceChildren(h('button', { class: 'btn btn-ghost', onclick: () => modal.close() }, 'Cancel'));
    onFrame = () => {
      clock.textContent = sim.timeLeft != null ? `${sim.timeLeft.toFixed(1)}s` : '';
      clock.classList.toggle('is-low', sim.timeLeft < 3);
      fill.style.width = `${sim.progress * 100}%`;
      line.textContent = status();
      sounds();
    };
    keyHandler = (e, down) => {
      if (!GAME_KEYS.includes(e.code)) return;
      e.preventDefault();
      if (!e.repeat) sim.key(e.code, down);
    };
  }

  // ── Math quiz (Classroom) ──────────────────────────────────────
  function buildQuiz() {
    const equation = h('div', { class: 'quiz-equation', 'aria-live': 'polite' });
    const timer = h('div', { class: 'game-meter-fill' });
    const buttons = Array.from({ length: 4 }, (_, i) =>
      h('button', { class: 'btn quiz-choice', type: 'button', onclick: () => pickAnswer(i) }),
    );
    let shown = null; // the question on screen
    const render = () => {
      if (sim.done || sim.question === shown) return;
      shown = sim.question;
      equation.textContent = `${sim.question.text} = ?`;
      buttons.forEach((b, i) => {
        b.textContent = sim.choices[i];
        b.dataset.key = i + 1;
      });
    };
    function pickAnswer(i) {
      sim.answer(i);
    }
    play.replaceChildren(equation, h('div', { class: 'game-meter quiz-timer', 'aria-hidden': 'true' }, timer), h('div', { class: 'quiz-choices' }, buttons));
    actions.replaceChildren(h('button', { class: 'btn btn-ghost', onclick: () => modal.close() }, 'Cancel'));
    render();
    buttons[0].focus();
    onFrame = () => {
      timer.style.width = `${(sim.timeLeft / sim.perQuestion) * 100}%`;
      timer.classList.toggle('is-low', sim.timeLeft < sim.perQuestion - sim.perfectWithin);
      render();
    };
    keyHandler = (e, down) => {
      const n = Number(e.key);
      if (down && !e.repeat && n >= 1 && n <= 4) {
        e.preventDefault();
        pickAnswer(n - 1);
      }
    };
  }

  // ── Loop ───────────────────────────────────────────────────────
  function frame(now) {
    sim.update(Math.min(0.1, (now - last) / 1000));
    last = now;
    onFrame();
    while (seen < sim.results.length) showGrade(sim.results[seen++]);
    if (sim.done) finish();
    else raf = requestAnimationFrame(frame);
  }

  function showGrade(grade) {
    pips.children[seen - 1]?.classList.add(`is-${grade}`);
    feedback.textContent = CHECKPOINT_LABELS[grade];
    // a wrong or timed-out answer shows what it should have been
    if (exerciseId === 'classroom' && grade === 'miss') feedback.textContent = `${sim.last.picked == null ? "Time's up!" : 'Not quite!'} It was ${sim.last.answer}.`;
    feedback.dataset.grade = grade;
    playSfx(GRADE_SFX[grade]);
    scene.rep(grade);
  }

  function finish() {
    cancelAnimationFrame(raf);
    keyHandler = () => {};
    play.replaceChildren(); // the controls are done with: make room for the results
    result = completeTraining(pet, exerciseId, sim.qualities, { difficulty });
    scene.finish(result.avgQ >= 0.6);
    setTimeout(() => playSfx(result.levels ? 'levelup' : 'trained'), 250);
    const lines = [
      ...result.gains.map(({ stat, gain }) => `${STAT_LABELS[stat]} ${gain > 0 ? '+' : ''}${formatStat(stat, gain)}`),
      `+${result.xp} XP`,
    ];
    if (result.reward !== 1) lines.push(`${TRAINING_DIFFICULTY[difficulty].name} ×${result.reward}`);
    if (result.specialty) lines.push('Specialty bonus ×1.5');
    if (result.boosted) lines.push('Protein boost ×1.3');
    if (result.levels) lines.push(`LEVEL UP! Now Lv ${pet.level}`);
    for (const id of result.learned) lines.push(learnedLine(pet, id));
    const m = mastery(pet, exerciseId);
    lines.push(m.next ? `Mastery ${Math.floor(m.points)} / ${m.next}` : 'Station mastered!');
    delete feedback.dataset.grade;
    feedback.replaceChildren(h('strong', {}, 'Session complete'), h('ul', { class: 'result-list' }, lines.map((l) => h('li', {}, l))));
    showDone();
    if (result.breakthroughs.length) offerMove(result.breakthroughs[0]);
  }

  function showDone() {
    actions.replaceChildren(h('button', { class: 'btn btn-primary', onclick: () => modal.close() }, 'Done'));
    actions.querySelector('button').focus();
  }

  /** Progressive overload paid off: offer the station's move. */
  function offerMove(moveId) {
    const a = ABILITIES[moveId];
    setTimeout(() => playSfx('levelup'), 700);
    const box = h(
      'div',
      { class: 'breakthrough' },
      h('strong', {}, 'BREAKTHROUGH!'),
      h('p', {}, `${pet.name} pushed past their limit at the ${ex.name} and can learn a new move:`),
      h('div', { class: 'ability-name' }, a.name, h('span', { class: 'tag' }, `CD ${a.cooldown}`)),
      h('p', { class: 'food-desc' }, a.desc),
    );
    feedback.append(box);
    actions.replaceChildren(
      h('button', {
        class: 'btn btn-primary',
        onclick: () => {
          learnTrainingMove(pet, exerciseId, moveId);
          box.replaceChildren(h('strong', {}, learnedLine(pet, moveId)));
          showDone();
        },
      }, `Learn ${a.name}`),
      h('button', {
        class: 'btn btn-ghost',
        onclick: () => {
          box.replaceChildren(h('p', { class: 'muted' }, `You can learn ${a.name} later from the Train tab.`));
          showDone();
        },
      }, 'Not now'),
    );
    actions.querySelector('button').focus();
  }

  let keyHandler = () => {};
  const onKeyDown = (e) => keyHandler(e, true);
  const onKeyUp = (e) => keyHandler(e, false);

  const modal = openModal(body, {
    label: `${ex.name} training`,
    onClose: () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      stage.destroy();
      onComplete?.(result); // null if cancelled
    },
  });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  showPicker();
  modal.el.querySelector('.btn-primary')?.focus();
}
