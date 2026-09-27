/**
 * Animated training stations for the training modal (Digimon World style).
 * createTrainingScene sets up a PetStage for one exercise and returns
 *   rep(grade)       : react to a rep ('perfect' | 'good' | 'miss')
 *   finish(success)  : end-of-session flourish
 * Props are drawn by sprites/trainingProps.js.
 */
import { SPRITES } from '../../sprites/animals.js';
import { spriteSize } from '../../sprites/renderer.js';
import * as P from '../../sprites/trainingProps.js';

export const SCENE_SIZE = { width: 192, height: 88 };
const GROUND = 80;
const W = SCENE_SIZE.width;
const ease = (p) => 1 - (1 - p) ** 3;

/** Frame timer for scenes that move things every frame. */
function ticker() {
  let last = null;
  return (t) => {
    const dt = last == null ? 0 : Math.min(0.1, t - last);
    last = t;
    return dt;
  };
}

// ── Boulder Moving: push a boulder down a dirt track to the flag ──
function boulder(stage, species, pw) {
  const r = 14;
  const startX = 8 + pw / 2;
  const flagX = W - 10;
  const travel = flagX - (startX + pw / 2 + r * 2 - 3) - 3;
  let pos = 0;
  let target = 0;
  const tick = ticker();
  stage.background = 'meadow';
  stage.addActor('pet', { species, x: startX, y: GROUND });
  // leaning into the rock, trembling with effort
  stage.setIdle('pet', (t) => ({ angle: 0.16, dx: Math.round(Math.sin(t * 40)) * 0.5, sy: 0.97 }));
  const rockX = () => startX + pos + pw / 2 + r - 3;
  stage.setLayers({
    back: (ctx, t) => {
      pos += (target - pos) * Math.min(1, tick(t) * 5);
      stage.setActor('pet', { x: startX + pos });
      P.dirtTrack(ctx, W, GROUND - 12, SCENE_SIZE.height);
      P.finishFlag(ctx, flagX, GROUND, t);
    },
    front: (ctx) => P.boulder(ctx, rockX(), GROUND, r, pos / r),
  });
  return {
    rep(grade) {
      if (grade === 'miss') {
        target = Math.max(0, target - 4);
        stage.play('pet', 'hurt');
        stage.emote('pet', 'drop');
        return;
      }
      target = Math.min(travel, target + (travel / 3) * (grade === 'perfect' ? 1 : 0.6));
      stage.effect(P.dustPuff(startX + pos - pw / 3, GROUND - 2, 1), 0.6);
      stage.effect(P.dustPuff(rockX() + r / 2, GROUND - 1, -1), 0.6, { delay: 0.15 });
      if (grade === 'perfect') {
        stage.shake(1, 0.3);
        stage.emote('pet', 'star');
      }
    },
  };
}

// ── Waterfall: endure the pressure in deep concentration ──────────
function waterfall(stage, species, pw) {
  const cx = W / 2;
  const fallW = pw + 12;
  const box = () => stage.actorBox('pet');
  let pressure = 0; // extra squash after a miss
  const tick = ticker();
  stage.background = 'meadow';
  stage.addActor('pet', { species, x: cx, y: GROUND });
  // eyes shut, bowed slightly under the weight of the water
  stage.setIdle('pet', (t) => ({ variant: 'blink', sy: 0.96 - pressure * 0.12 + Math.sin(t * 9) * 0.012 }));
  stage.setLayers({
    back: (ctx, t) => {
      pressure = Math.max(0, pressure - tick(t) * 1.5);
      P.cliff(ctx, cx - fallW / 2 - 18, cx + fallW / 2 + 18, GROUND - 6);
      P.waterStream(ctx, cx - fallW / 2, fallW, 0, GROUND - 4, t);
      P.plungePool(ctx, cx, GROUND, fallW + 30, t);
    },
    front: (ctx, t) => {
      const b = box();
      const top = b.cy - b.h / 2 + 4;
      P.waterStream(ctx, cx - fallW / 2 + 3, fallW - 6, top, GROUND - 2, t, 0.35);
      P.splash(ctx, cx, top, fallW / 2, t);
    },
  });
  return {
    rep(grade) {
      if (grade === 'miss') {
        pressure = 1;
        stage.shake(2, 0.4);
        stage.play('pet', 'hurt');
        return;
      }
      stage.emote('pet', grade === 'perfect' ? 'star' : 'sparkle', grade === 'perfect' ? 2 : 1);
    },
  };
}

// ── Striking log: strike a wooden post ────────────────────────────
function strikingLog(stage, species, pw) {
  const gap = 8;
  const left = (W - (pw + gap + 12)) / 2;
  const petX = left + pw / 2;
  const logX = left + pw + gap + 6;
  let hitAt = -99;
  let hitPower = 0;
  stage.background = 'meadow';
  stage.addActor('pet', { species, x: petX, y: GROUND });
  stage.setIdle('pet', (t) => ({ dy: -Math.round(Math.abs(Math.sin(t * 5)) * 2) }));
  stage.setLayers({
    back: (ctx, t) => {
      const age = t - hitAt;
      const wobble = age >= 0 ? hitPower * Math.exp(-age * 5) * Math.sin(age * 30) : 0;
      P.strikingLog(ctx, logX, GROUND, wobble);
    },
  });
  const strike = (delay, power) => {
    stage.animate('pet', (p) => ({ dx: Math.round(Math.sin(p * Math.PI) * (gap + 6)), angle: Math.sin(p * Math.PI) * 0.12 }), 0.3, { delay });
    const at = delay + 0.14;
    stage.effect(P.impactBurst(logX - 6, GROUND - 23, { size: 6 + power * 20 }), 0.35, { delay: at });
    stage.effect(P.woodChips(logX, GROUND - 24, 1, 4 + Math.round(power * 20)), 0.7, { delay: at });
    setTimeout(() => {
      hitAt = stage.now;
      hitPower = power;
    }, at * 1000);
  };
  return {
    rep(grade) {
      if (grade === 'miss') {
        stage.animate('pet', (p) => ({ dx: Math.round(Math.sin(p * Math.PI) * 4), angle: -Math.sin(p * Math.PI) * 0.1 }), 0.35);
        stage.emote('pet', 'drop');
        return;
      }
      strike(0, grade === 'perfect' ? 0.15 : 0.08);
      if (grade === 'perfect') {
        strike(0.32, 0.25); // one-two combo
        stage.shake(2, 0.3, { delay: 0.46 });
        stage.emote('pet', 'star');
      }
    },
  };
}

// ── Punch glove: block a spring-loaded glove ──────────────────────
function punchGlove(stage, species, pw) {
  const reachMax = 36;
  const left = (W - (pw + reachMax + 16 + 20)) / 2;
  const petX = left + pw / 2;
  const machineX = left + pw + reachMax + 16;
  let punchAt = -99;
  let knock = 0; // how far the glove shoves the pet
  stage.background = 'meadow';
  stage.addActor('pet', { species, x: petX, y: GROUND });
  // guard stance
  stage.setIdle('pet', (t) => ({ angle: -0.04, dy: -Math.round(Math.abs(Math.sin(t * 3)) * 1) }));
  const reachAt = (t) => {
    const p = (t - punchAt) / 0.6;
    if (p < 0 || p > 1) return 6 + Math.sin(t * 4); // idle wind-up jiggle
    const out = p < 0.2 ? ease(p / 0.2) : p < 0.4 ? 1 : 1 - (p - 0.4) / 0.6;
    return 6 + (reachMax - 6 + knock) * out;
  };
  stage.setLayers({ back: (ctx, t) => P.punchMachine(ctx, machineX, GROUND, reachAt(t)) });
  const front = () => petX + pw / 2;
  return {
    rep(grade) {
      punchAt = stage.now;
      knock = grade === 'perfect' ? 0 : grade === 'good' ? 4 : 12;
      const d = { delay: 0.1 };
      if (grade === 'perfect') {
        stage.effect(P.blockShield(front() + 2, GROUND - 22, 1, 24), 0.4, d);
        stage.animate('pet', (p) => ({ angle: -0.1 * Math.sin(p * Math.PI) }), 0.3, d);
        stage.emote('pet', 'star');
      } else if (grade === 'good') {
        stage.effect(P.impactBurst(front(), GROUND - 22, { size: 6 }), 0.3, d);
        stage.animate('pet', (p) => ({ dx: -Math.round(Math.sin(p * Math.PI) * 5), angle: -0.08 * Math.sin(p * Math.PI) }), 0.35, d);
      } else {
        stage.effect(P.impactBurst(front() - 10, GROUND - 22, { size: 10, color: '#ef7d57' }), 0.35, d);
        stage.animate('pet', (p) => ({ dx: -Math.round(Math.sin(p * Math.PI) * 14), variant: p < 0.4 && Math.floor(p * 20) % 2 ? 'flash' : 'normal' }), 0.5, d);
        stage.shake(2, 0.3, d);
      }
    },
  };
}

// ── Running track: sprint back and forth down the lane ────────────
function running(stage, species, pw) {
  const minX = 10 + pw / 2;
  const maxX = W - 10 - pw / 2;
  let x = minX;
  let dir = 1;
  let boost = 1;
  let boostUntil = 0;
  let stopUntil = 0;
  let nextDust = 0;
  const tick = ticker();
  stage.background = 'meadow';
  stage.addActor('pet', { species, x, y: GROUND });
  stage.setIdle('pet', (t) =>
    t < stopUntil ? { angle: -0.05 } : { dy: -Math.round(Math.abs(Math.sin(t * 14)) * 3), angle: 0.08, trail: t < boostUntil && boost > 1.5 },
  );
  stage.setLayers({
    back: (ctx, t) => {
      const dt = tick(t);
      if (t >= stopUntil) {
        const speed = 55 * (t < boostUntil ? boost : 1);
        x += dir * speed * dt;
        if (x >= maxX || x <= minX) {
          x = Math.min(maxX, Math.max(minX, x));
          dir = -dir;
          stage.setActor('pet', { flip: dir < 0 });
        }
        stage.setActor('pet', { x });
        if (t > nextDust) {
          nextDust = t + 0.25;
          stage.effect(P.dustPuff(x - dir * pw * 0.4, GROUND - 2, dir), 0.5);
        }
      }
      P.runningTrack(ctx, W, GROUND - 14, SCENE_SIZE.height);
    },
  });
  return {
    rep(grade) {
      const now = stage.now;
      if (grade === 'miss') {
        stopUntil = now + 0.7; // trips and has to get going again
        stage.play('pet', 'hurt');
        stage.emote('pet', 'drop');
        return;
      }
      boost = grade === 'perfect' ? 2.2 : 1.4;
      boostUntil = now + (grade === 'perfect' ? 0.9 : 0.5);
      if (grade === 'perfect') stage.emote('pet', 'star');
    },
  };
}

// ── Classroom: study at a desk until the lightbulb goes on ────────
function classroom(stage, species, pw) {
  const cx = W / 2;
  const deskH = Math.max(12, Math.min(18, Math.round(spriteSize(SPRITES[species]).h * 0.4)));
  let pageAt = -99;
  let dozeUntil = 0;
  stage.background = null;
  stage.addActor('pet', { species, x: cx, y: GROUND - 4 });
  stage.setIdle('pet', (t) =>
    t < dozeUntil ? { angle: 0.12, variant: 'blink' } : { angle: Math.sin(t * 1.4) * 0.03, variant: (t % 4) < 0.15 ? 'blink' : undefined },
  );
  stage.setLayers({
    back: (ctx) => P.classroom(ctx, W, SCENE_SIZE.height, GROUND),
    front: (ctx, t) => P.desk(ctx, cx, GROUND + 2, Math.max(56, pw + 6), (t - pageAt) / 0.4, deskH),
  });
  const bulbAt = () => {
    const b = stage.actorBox('pet');
    return { x: b.cx + b.w * 0.18, y: Math.max(12, b.cy - b.h / 2 - 12) };
  };
  return {
    rep(grade) {
      if (grade === 'miss') {
        dozeUntil = stage.now + 0.9;
        stage.emote('pet', 'question');
        return;
      }
      pageAt = stage.now;
      const { x, y } = bulbAt();
      stage.effect(P.lightbulb(x, y, grade === 'perfect'), 1.1);
      if (grade === 'perfect') stage.emote('pet', 'sparkle', 2);
    },
  };
}

const SCENES = { boulder, waterfall, log: strikingLog, glove: punchGlove, running, classroom };

export function createTrainingScene(exerciseId, stage, species) {
  const scene = SCENES[exerciseId](stage, species, spriteSize(SPRITES[species]).w);
  return {
    rep: scene.rep,
    finish(success) {
      if (!success) return;
      setTimeout(() => stage.emote('pet', 'heart', 2), 500);
    },
  };
}
