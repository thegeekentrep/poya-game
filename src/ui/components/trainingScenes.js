/**
 * Animated training stations for the training modal (Digimon World style).
 * createTrainingScene sets up a PetStage for one exercise and returns
 *   rep(grade)       : react to a rep or checkpoint ('perfect' | 'good' | 'miss')
 *   fall()           : the pet toppled (Waterfall)
 *   finish(success)  : end-of-session flourish
 * Every station but the Classroom draws its game's state (training/games.js,
 * logChop.js, gloveBlock.js) every frame.
 * Props are drawn by sprites/trainingProps.js.
 */
import { SPRITES } from '../../sprites/animals.js';
import { spriteSize } from '../../sprites/renderer.js';
import * as P from '../../sprites/trainingProps.js';
import { punchOn, punchPose } from '../../training/gloveBlock.js';

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

// ── Boulder Moving: shove a boulder down a dirt track to the flag (BoulderGame) ──
function boulder(stage, species, pw, game) {
  const r = 14;
  const startX = 8 + pw / 2;
  const flagX = W - 10;
  const travel = flagX - (startX + pw / 2 + r * 2 - 3) - 3;
  const tick = ticker();
  let nextDust = 0;
  let nextSweat = 0;
  stage.background = 'meadow';
  stage.addActor('pet', { species, x: startX, y: GROUND });
  // leaning into the rock: hard and trembling while shoved, sagging as it rolls back
  stage.setIdle('pet', (t) =>
    game.straining
      ? { angle: 0.22, dx: Math.round(Math.sin(t * 40)) * 0.5, sy: 0.95 }
      : { angle: game.vel < -0.01 ? 0.05 : 0.12, sy: 0.98 },
  );
  const px = () => startX + game.pos * travel;
  const rockX = () => px() + pw / 2 + r - 3;
  stage.setLayers({
    back: (ctx, t) => {
      tick(t);
      stage.setActor('pet', { x: px() });
      if (game.straining && t > nextDust) {
        nextDust = t + 0.12;
        stage.effect(P.dustPuff(px() - pw / 3, GROUND - 2, 1), 0.5);
        stage.effect(P.dustPuff(rockX() + r / 2, GROUND - 1, -1), 0.5);
      }
      // losing ground: the pet sweats as the rock rolls back on it
      if (!game.done && game.vel < -0.03 && game.pos > 0 && t > nextSweat) {
        nextSweat = t + 0.8;
        stage.emote('pet', 'drop');
      }
      P.dirtTrack(ctx, W, GROUND - 12, SCENE_SIZE.height);
      for (let i = 1; i < 3; i++) {
        const x = startX + (travel * i) / 3 + pw / 2 + r * 2;
        P.checkpoint(ctx, x, GROUND - 12, SCENE_SIZE.height, game.results.length >= i);
      }
      P.finishFlag(ctx, flagX, GROUND, t);
    },
    front: (ctx) => P.boulder(ctx, rockX(), GROUND, r, (game.pos * travel) / r),
  });
  return {
    rep(grade) {
      if (grade === 'miss') stage.emote('pet', 'drop');
      else {
        stage.emote('pet', grade === 'perfect' ? 'star' : 'sparkle');
        if (grade === 'perfect') stage.shake(1, 0.3);
      }
    },
  };
}

// ── Waterfall: balance on a slick rock under the falls (WaterfallGame) ──
function waterfall(stage, species, pw, game) {
  const cx = W / 2;
  const fallW = pw + 12;
  const box = () => stage.actorBox('pet');
  const tick = ticker();
  let nextSweat = 0;
  stage.background = 'meadow';
  stage.addActor('pet', { species, x: cx, y: GROUND - 2 });
  stage.setIdle('pet', () => {
    if (game.fallen) {
      // slipped off: sprawled in the pool, then scrambling back up
      const k = (game.time - game.fellAt) / 1.2;
      const down = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
      return { angle: game.fellSide * 1.3 * down, dx: game.fellSide * 16 * down, dy: 6 * down, variant: 'blink' };
    }
    const lean = game.tilt;
    return { angle: lean * 0.75, dx: Math.round(lean * 5), sy: 0.97, variant: Math.abs(lean) > 0.6 ? 'normal' : 'blink' };
  });
  stage.setLayers({
    back: (ctx, t) => {
      tick(t);
      if (!game.done && !game.fallen && Math.abs(game.tilt) > 0.7 && t > nextSweat) {
        nextSweat = t + 0.6; // wobbling on the edge
        stage.emote('pet', 'drop');
      }
      P.cliff(ctx, cx - fallW / 2 - 18, cx + fallW / 2 + 18, GROUND - 6);
      P.waterStream(ctx, cx - fallW / 2 + game.wind * 4, fallW, 0, GROUND - 4, t);
      P.plungePool(ctx, cx, GROUND, fallW + 44, t);
      P.balanceRock(ctx, cx, GROUND - 2, Math.max(14, pw * 0.45));
    },
    front: (ctx, t) => {
      const b = box();
      const top = b.cy - b.h / 2 + 4;
      const surge = game.wind * 6; // the stream shoves from one side, then the other
      P.waterStream(ctx, cx - fallW / 2 + 3 + surge, fallW - 6, top, GROUND - 2, t, 0.35);
      P.splash(ctx, cx + surge, top, fallW / 2, t);
    },
  });
  return {
    rep(grade) {
      if (grade === 'miss') return;
      stage.emote('pet', grade === 'perfect' ? 'star' : 'sparkle', grade === 'perfect' ? 2 : 1);
    },
    /** called by the modal when the pet topples */
    fall() {
      stage.shake(2, 0.4);
      stage.effect(P.impactBurst(cx + game.fellSide * 18, GROUND - 4, { color: '#73eff7', size: 10 }), 0.4);
    },
  };
}

// ── Striking Log: chop a tall log from the bottom, dodging branches (LogChopGame) ──
function strikingLog(stage, species, pw, game) {
  const { h: ph } = spriteSize(SPRITES[species]);
  const cx = W / 2;
  const tw = 16; // log width
  const tx = cx - tw / 2;
  const seg = 9; // segment height
  const stumpH = Math.max(8, Math.min(30, Math.round(ph * 0.55))); // the bottom segment sits at the pet's head
  const bottomOf = (i) => GROUND - stumpH - i * seg; // bottom edge of the i-th segment above the stump
  const petX = { L: tx - 2 - pw / 2, R: tx + tw + 2 + pw / 2 };
  const toward = (side) => (side === 'L' ? 1 : -1); // direction from the pet to the log
  let seenChops = 0;
  let seenBonks = 0;
  let dropAt = -99;
  stage.background = 'meadow';
  stage.addActor('pet', { species, x: petX[game.side], y: GROUND });
  stage.setIdle('pet', (t) =>
    game.stunned
      ? { angle: Math.sin(t * 18) * 0.12, variant: 'blink' } // dazed
      : { dy: -Math.round(Math.abs(Math.sin(t * 5)) * 1) },
  );

  const react = () => {
    while (seenChops < game.chopped) {
      const { side, row } = game.lastChop;
      const dir = toward(side);
      seenChops = game.chopped;
      dropAt = stage.now;
      stage.setActor('pet', { x: petX[side], flip: side === 'R' });
      stage.animate('pet', (p) => ({ dx: Math.round(Math.sin(p * Math.PI) * 5) * dir, angle: Math.sin(p * Math.PI) * 0.15 }), 0.16);
      stage.effect(P.flyingChunk(tx, bottomOf(0) - seg, tw, seg, dir, row, game.branches[row]), 0.55);
      stage.effect(P.woodChips(cx - dir * tw * 0.4, bottomOf(0) - seg / 2, dir, 6), 0.5);
      stage.effect(P.impactBurst(cx - dir * tw * 0.5, bottomOf(0) - seg / 2, { size: 6 }), 0.2);
    }
    if (game.bonks > seenBonks) {
      seenBonks = game.bonks;
      const { side } = game.lastBonk;
      stage.setActor('pet', { x: petX[side], flip: side === 'R' });
      stage.play('pet', 'hurt');
      stage.emote('pet', 'star', 2);
      stage.shake(2, 0.25);
      stage.effect(P.fallingBranch(tx, tw, bottomOf(0) - seg + 3, side), 0.6);
    }
  };

  stage.setLayers({
    back: (ctx, t) => {
      react();
      P.logStump(ctx, tx, GROUND, tw, stumpH, game.chopped >= game.total);
      // the log above drops into place after each chop
      const drop = -Math.round(seg * (1 - ease(Math.min(1, (t - dropAt) / 0.09))));
      for (let i = 0; game.chopped + i < game.total; i++) {
        const row = game.chopped + i;
        const y = bottomOf(i) - seg + drop;
        if (y + seg < 0) break;
        P.logSegment(ctx, tx, y, tw, seg, row);
        if (game.branchAt(row)) P.logBranch(ctx, tx, tw, y + 3, game.branchAt(row));
        if (row === game.total - 1) P.treeCrown(ctx, cx, y);
      }
    },
  });
  return {
    rep(grade) {
      if (grade === 'miss') stage.emote('pet', 'drop');
      else stage.emote('pet', grade === 'perfect' ? 'star' : 'sparkle');
    },
  };
}

// ── Punch Glove: block gloves punching from both sides (GloveGame) ──
function punchGlove(stage, species, pw, game) {
  const cx = W / 2;
  const machineX = W - 24; // the right machine; the left one is its mirror image
  const reachMax = Math.max(8, machineX - 14 - (cx + pw / 2) + 3); // glove just meets the pet
  const guardY = GROUND - 22;
  let seen = 0;
  stage.background = 'meadow';
  stage.addActor('pet', { species, x: cx, y: GROUND });
  // guard stance: braced toward the raised side, otherwise bouncing on its toes
  stage.setIdle('pet', (t) => {
    const g = game.guard;
    if (g && game.time <= g.until) return { angle: -0.12, dx: (g.side === 'L' ? -1 : 1) * 2, sx: 0.95 };
    return { dy: -Math.round(Math.abs(Math.sin(t * 6)) * 1) };
  });

  const machine = (ctx, side, t) => {
    const punch = punchOn(game.punches, side, game.time);
    const { windup, reach } = punchPose(punch, game.time);
    const charging = punch && !punch.outcome && windup > 0 && windup < 1;
    ctx.save();
    if (side === 'L') {
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
    }
    P.punchMachine(ctx, machineX, GROUND, 6 + (reachMax - 6) * reach, { charge: charging ? windup : 0, t });
    ctx.restore();
  };

  let facing = 'R';
  const react = () => {
    // turn to face whichever side the guard goes up on
    const g = game.guard;
    if (g && game.time <= g.until && g.side !== facing) {
      facing = g.side;
      stage.setActor('pet', { flip: facing === 'L' });
    }
    if (game.resolved <= seen || !game.last) return;
    seen = game.resolved;
    const { outcome, side } = game.last;
    const dir = side === 'L' ? -1 : 1;
    const edge = cx + dir * (pw / 2 + 2);
    facing = side;
    stage.setActor('pet', { flip: side === 'L' });
    if (outcome === 'hit') {
      stage.animate('pet', (p) => ({ dx: -dir * Math.round(Math.sin(p * Math.PI) * 12), angle: 0.15 * Math.sin(p * Math.PI), variant: p < 0.4 && Math.floor(p * 20) % 2 ? 'flash' : 'normal' }), 0.45);
      stage.effect(P.impactBurst(edge, guardY, { size: 10, color: '#ef7d57' }), 0.35);
      stage.emote('pet', 'drop');
      stage.shake(2, 0.25);
    } else {
      const parry = outcome === 'parry';
      stage.effect(P.blockShield(edge, guardY, dir, 26), parry ? 0.5 : 0.35);
      stage.effect(P.impactBurst(edge + dir * 3, guardY, { size: parry ? 9 : 5, color: parry ? '#73eff7' : '#f4f4f4' }), 0.3);
      stage.animate('pet', (p) => ({ dx: -dir * Math.round(Math.sin(p * Math.PI) * (parry ? 1 : 4)), angle: -0.12 }), 0.25);
      if (parry) stage.emote('pet', 'star');
    }
  };

  stage.setLayers({
    back: (ctx, t) => {
      react();
      machine(ctx, 'L', t);
      machine(ctx, 'R', t);
    },
    // the raised guard: a shimmering shield on that side
    front: (ctx, t) => {
      const g = game.guard;
      if (!g || game.time > g.until) return;
      const dir = g.side === 'L' ? -1 : 1;
      P.blockShield(cx + dir * (pw / 2 + 2), guardY, dir, 22)(ctx, 0.35 + Math.sin(t * 30) * 0.1);
    },
  });
  return {
    rep(grade) {
      if (grade === 'miss') stage.emote('pet', 'drop');
      else stage.emote('pet', grade === 'perfect' ? 'star' : 'sparkle');
    },
  };
}

// ── Running: sprint down the track to the finish line (RunningGame) ──
function running(stage, species, pw, game) {
  const startX = 10 + pw / 2;
  const flagX = W - 12;
  const endX = flagX - pw / 2 - 2;
  const tick = ticker();
  let stride = 0; // leg-cycle phase; advances faster the quicker the pace
  let nextDust = 0;
  stage.background = 'meadow';
  stage.addActor('pet', { species, x: startX, y: GROUND });
  stage.setIdle('pet', () => {
    const pace = game.pace;
    if (pace < 0.05) return { angle: -0.03 };
    return { dy: -Math.round(Math.abs(Math.sin(stride)) * (1 + pace * 3)), angle: 0.04 + pace * 0.1, trail: pace > 0.7 };
  });
  stage.setLayers({
    back: (ctx, t) => {
      const dt = tick(t);
      stride += dt * (4 + game.pace * 16);
      const x = startX + game.pos * (endX - startX);
      stage.setActor('pet', { x });
      if (game.pace > 0.15 && t > nextDust) {
        nextDust = t + 0.35 - game.pace * 0.25;
        stage.effect(P.dustPuff(x - pw * 0.4, GROUND - 2, 1), 0.5);
      }
      P.runningTrack(ctx, W, GROUND - 14, SCENE_SIZE.height);
      for (let i = 1; i < 3; i++) {
        P.checkpoint(ctx, startX + ((endX - startX) * i) / 3 + pw / 2, GROUND - 14, SCENE_SIZE.height, game.results.length >= i);
      }
      P.finishFlag(ctx, flagX, GROUND, t);
    },
  });
  return {
    rep(grade) {
      if (grade === 'miss') stage.emote('pet', 'drop');
      else stage.emote('pet', grade === 'perfect' ? 'star' : 'sparkle');
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

/** game: the station's gesture game (training/games.js), if it has one. */
export function createTrainingScene(exerciseId, stage, species, game = null) {
  const scene = SCENES[exerciseId](stage, species, spriteSize(SPRITES[species]).w, game);
  return {
    rep: scene.rep,
    fall: scene.fall ?? (() => {}),
    finish(success) {
      if (!success) return;
      setTimeout(() => stage.emote('pet', 'heart', 2), 500);
    },
  };
}
