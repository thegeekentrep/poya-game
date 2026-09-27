/**
 * Tap-to-cuddle on a PetStage. Rules live in care/care.js (tapPet);
 * this turns taps on the pet into reactions: hearts, squirming, or an annoyed pet.
 */
import { tapPet, createCuddleTracker, CUDDLE_RULES } from '../../care/care.js';
import { playSfx } from '../../audio/sfx.js';
import { SPECIES } from '../../pets/species.js';

const PAD = 4; // stage pixels of slack around the sprite

/** onChange(result) runs after any tap that changed the pet (needs a save / refresh). */
export function attachCuddle(stage, actorId, pet, { toast, onChange }) {
  const tracker = createCuddleTracker();
  const canvas = stage.canvas;
  let turnBack = 0;

  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', `${canvas.getAttribute('aria-label')}. Tap to cuddle.`);

  const toStage = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
  };
  const onPet = ({ x, y }) => {
    const b = stage.actorBox(actorId);
    return b && Math.abs(x - b.cx) <= b.w / 2 + PAD && Math.abs(y - b.cy) <= b.h / 2 + PAD;
  };

  const actor = () => stage.actors.get(actorId);
  const homeFlip = actor().flip;

  function tap() {
    const res = tapPet(pet, tracker);
    if (res.message && (res.kind !== 'cuddle' || res.happiness)) toast(res.message, res.kind === 'cuddle' ? 'good' : 'warn');
    REACTIONS[res.kind](res);
    if (res.happiness) onChange(res);
  }

  const REACTIONS = {
    cuddle: (res) => {
      playSfx('cuddle');
      // a happy squish and wiggle
      stage.animate(actorId, (p) => ({ sy: 1 - Math.sin(p * Math.PI) * 0.1, sx: 1 + Math.sin(p * Math.PI) * 0.05, angle: Math.sin(p * Math.PI * 4) * 0.05 }), 0.5);
      stage.emote(actorId, 'heart', res.happiness ? 2 : 1);
    },
    fidget: () => {
      // the closer to snapping, the more irritated the grunt: 0 on the first squirm, 1 on the last
      const irritation = (tracker.taps.length - CUDDLE_RULES.fidgetTaps) / Math.max(1, CUDDLE_RULES.annoyTaps - CUDDLE_RULES.fidgetTaps - 1);
      playSfx('grunt', { pitch: SPECIES[pet.species].voicePitch, irritation: Math.min(1, irritation) });
      stage.animate(actorId, (p) => ({ dx: Math.round(Math.sin(p * Math.PI * 6) * 2), angle: Math.sin(p * Math.PI * 6) * 0.04 }), 0.45);
      stage.emote(actorId, 'drop');
    },
    annoyed: () => {
      playSfx('growl', { pitch: SPECIES[pet.species].voicePitch });
      stage.play(actorId, 'hurt');
      stage.shake(1.5, 0.3);
      stage.emote(actorId, 'anger', 3);
      turnAway();
    },
    pester: (res) => {
      if (res.happiness) playSfx('growl', { pitch: SPECIES[pet.species].voicePitch, short: true });
      stage.animate(actorId, (p) => ({ dx: Math.round(Math.sin(p * Math.PI * 8) * 1.5) }), 0.3);
      stage.emote(actorId, 'anger');
      turnAway();
    },
    asleep: () => stage.emote(actorId, 'z'),
  };

  // back turned until it calms down
  function turnAway() {
    stage.setActor(actorId, { flip: !homeFlip });
    clearTimeout(turnBack);
    const wait = () => {
      const left = tracker.annoyedUntil - Date.now();
      if (left > 0) turnBack = setTimeout(wait, left + 50);
      else stage.setActor(actorId, { flip: homeFlip });
    };
    wait();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (onPet(toStage(e))) {
      e.preventDefault();
      tap();
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    canvas.style.cursor = onPet(toStage(e)) ? 'pointer' : '';
  });
  canvas.addEventListener('keydown', (e) => {
    if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
      e.preventDefault();
      tap();
    }
  });

  return { destroy: () => clearTimeout(turnBack) };
}
