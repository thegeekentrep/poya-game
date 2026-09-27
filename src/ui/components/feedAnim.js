/**
 * Feeding animation on a PetStage: the food drops in front of the pet, the pet
 * leans in and takes bites (the food shrinks, crumbs fly), then reacts.
 * outcome: 'favorite' | 'neutral' | 'disliked' | 'medicine' | 'refuse' (too full).
 */
import { FOOD_SPRITES } from '../../sprites/foods.js';
import { SPRITES } from '../../sprites/animals.js';
import { drawSprite, spriteSize } from '../../sprites/renderer.js';
import { playSfx } from '../../audio/sfx.js';

// bite times and when the reaction starts, in seconds
const TIMING = {
  favorite: { bites: [0.5, 0.68, 0.86, 1.04], end: 1.2 },
  neutral: { bites: [0.55, 0.85, 1.15], end: 1.35 },
  disliked: { bites: [0.65, 1.25], end: 1.45 },
  medicine: { bites: [0.6, 0.95], end: 1.15 },
  refuse: { bites: [], end: 0.45 },
};
const DROP = 0.35; // seconds for the food to fall
const FOOD_LIFE = 1.8; // how long a refused meal lies there

const smooth = (p) => p * p * (3 - 2 * p);
const tokens = new WeakMap(); // stage -> id of the feeding in progress, so a new one cancels the old

export function playFeeding(stage, actorId, foodId, outcome) {
  const box = stage.actorBox(actorId);
  const actor = stage.actors.get(actorId);
  const food = FOOD_SPRITES[foodId];
  if (!box || !actor || !food) return;
  const token = (tokens.get(stage) || 0) + 1;
  tokens.set(stage, token);
  const live = () => tokens.get(stage) === token;
  const later = (seconds, fn) => setTimeout(() => live() && fn(), seconds * 1000);

  const { bites, end } = TIMING[outcome];
  const dir = box.dir;
  const { w: fw, h: fh } = spriteSize(food);
  const foodX = Math.round(Math.min(stage.canvas.width - fw - 2, Math.max(2, box.x + dir * (box.w / 2 + 3) - fw / 2)));
  const groundY = box.y;
  const start = stage.now;
  const hover = SPRITES[actor.species].hover ?? 0;
  const eaten = (t) => bites.filter((b) => t >= b).length / Math.max(bites.length, 1);

  // the food: falls, bounces, then loses a slice from the pet's side at every bite
  const life = outcome === 'refuse' ? FOOD_LIFE : end + 0.05;
  stage.effect((ctx, p, age) => {
    if (!live()) return;
    const drop = Math.min(1, age / DROP);
    const bounce = age > DROP && age < DROP + 0.15 ? -Math.round(Math.sin(((age - DROP) / 0.15) * Math.PI) * 2) : 0;
    const y = Math.round(groundY - fh - (1 - drop * drop) * (groundY - fh + 4)) + bounce;
    const left = eaten(age);
    if (left >= 1) return;
    ctx.globalAlpha = outcome === 'refuse' && age > FOOD_LIFE - 0.4 ? (FOOD_LIFE - age) / 0.4 : 1;
    ctx.fillStyle = 'rgba(11, 12, 20, 0.3)';
    ctx.fillRect(foodX + 1, groundY - 1, fw - 2, 1);
    const cut = Math.round(fw * left);
    ctx.beginPath();
    ctx.rect(dir > 0 ? foodX + cut : foodX, 0, fw - cut, stage.canvas.height);
    ctx.clip();
    drawSprite(ctx, food, foodX, y);
  }, life);

  // the pet leans in, chomps at every bite, and fliers land to eat
  if (outcome !== 'refuse') {
    stage.animate(actorId, (p) => {
      const t = p * end;
      const lean = t < DROP ? 0 : t < DROP + 0.15 ? smooth((t - DROP) / 0.15) : t > end - 0.12 ? (end - t) / 0.12 : 1;
      const chomp = bites.some((b) => Math.abs(t - b) < 0.07);
      return {
        dx: Math.round(dir * 3 * lean),
        dy: hover * lean,
        angle: lean * (outcome === 'medicine' ? -0.15 : 0.22) + (chomp ? 0.08 : 0),
        sy: chomp ? 0.92 : 1,
        variant: outcome === 'disliked' && lean > 0.5 ? 'blink' : undefined, // eyes squeezed shut
      };
    }, end);
  }

  bites.forEach((b) =>
    later(b, () => {
      playSfx('chomp');
      stage.effect(crumbs(foodX + fw / 2, groundY - fh / 2, dir, Object.values(food.palette)), 0.5);
    }),
  );

  later(end, () => REACTIONS[outcome](stage, actorId, actor, later));
}

const REACTIONS = {
  favorite: (stage, id) => {
    playSfx('delight');
    stage.play(id, 'hop');
    stage.emote(id, 'heart', 3);
  },
  neutral: (stage, id) => {
    playSfx('content');
    stage.emote(id, 'note');
  },
  disliked: (stage, id) => {
    playSfx('grimace');
    stage.play(id, 'hurt');
    stage.emote(id, 'anger', 2);
  },
  medicine: (stage, id, actor, later) => {
    playSfx('grimace');
    // a full-body shudder at the taste, then it starts working
    stage.animate(id, (p) => ({ dx: (Math.floor(p * 16) % 2 ? 1 : -1), sx: 1.04, sy: 0.96 }), 0.5);
    stage.emote(id, 'drop');
    later(0.7, () => {
      playSfx('medicine');
      stage.emote(id, 'sparkle', 3);
    });
  },
  refuse: (stage, id, actor, later) => {
    playSfx('error');
    const flip = actor.flip;
    stage.setActor(id, { flip: !flip }); // turns its back on the food
    stage.emote(id, 'drop');
    later(1, () => stage.setActor(id, { flip }));
  },
};

function crumbs(x, y, dir, colors) {
  const bits = Array.from({ length: 6 }, (_, i) => ({ vx: (Math.random() * 20 + 6) * (i % 3 === 0 ? -dir : dir), vy: -(Math.random() * 24 + 12), c: colors[i % colors.length] }));
  return (ctx, p, age) => {
    ctx.globalAlpha = 1 - p;
    for (const b of bits) {
      ctx.fillStyle = b.c;
      ctx.fillRect(Math.round(x + b.vx * age), Math.round(y + b.vy * age + 80 * age * age), 1, 1);
    }
  };
}
