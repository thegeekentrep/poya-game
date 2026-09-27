import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SPECIES, SPECIES_ORDER } from '../src/pets/species.js';
import { createPet, getStats, addXp, xpToNext } from '../src/pets/pet.js';
import { tickNeeds, simulateAway } from '../src/pets/needs.js';
import { getMood } from '../src/pets/mood.js';
import { FOODS } from '../src/foods/foods.js';
import { feedPet, buyFood } from '../src/foods/feeding.js';
import { performCare } from '../src/care/care.js';
import { EXERCISES, EXERCISE_ORDER } from '../src/training/exercises.js';
import { completeTraining, trainingCap } from '../src/training/trainer.js';
import { TrainingSim } from '../src/training/simulator.js';
import { ABILITIES } from '../src/combat/abilities.js';
import { createFighter, createBattle, playRound } from '../src/combat/battle.js';
import { generateBot, chooseBotAbility } from '../src/combat/bots.js';
import { TROPHY_RULES, applyBattleResult, startBattle, isTierUnlocked, nextTier, highestUnlocked } from '../src/combat/arena.js';
import { SPRITES } from '../src/sprites/animals.js';

const makeGame = (species = 'wolf') => ({ pet: createPet(species), coins: 100, inventory: {}, record: { wins: 0, losses: 0 } });

test('every species references valid abilities, foods, exercises and sprites', () => {
  for (const id of SPECIES_ORDER) {
    const sp = SPECIES[id];
    for (const a of sp.abilities) assert.ok(ABILITIES[a], `${id}: ability ${a}`);
    for (const f of [...sp.favoriteFoods, ...sp.dislikedFoods]) assert.ok(FOODS[f], `${id}: food ${f}`);
    assert.ok(EXERCISES[sp.specialty], `${id}: specialty`);
    assert.ok(SPRITES[id], `${id}: sprite`);
  }
});

test('sprites are rectangular and fully paletted', () => {
  for (const [id, s] of Object.entries(SPRITES)) {
    const w = s.rows[0].length;
    s.rows.forEach((row, y) => {
      assert.equal(row.length, w, `${id} row ${y} width`);
      for (const ch of row) if (ch !== '.') assert.ok(s.palette[ch], `${id} missing colour '${ch}'`);
    });
    assert.ok(s.palette[s.blink], `${id} blink colour`);
  }
});

test('needs decay over time and starving hurts health', () => {
  const pet = createPet('gorilla');
  const start = { ...pet.needs };
  tickNeeds(pet, 600);
  assert.ok(pet.needs.hunger < start.hunger);
  assert.ok(pet.needs.hygiene < start.hygiene);
  pet.needs.hunger = 0;
  const hp = pet.needs.health;
  tickNeeds(pet, 120);
  assert.ok(pet.needs.health < hp);
  assert.equal(getMood(pet).id, 'starving');
});

test('offline catch-up is capped', () => {
  const pet = createPet('eagle');
  const r = simulateAway(pet, 1000 * 60 * 60 * 24 * 30, { rate: 0.35, capMinutes: 720 });
  assert.ok(r.after.hunger >= 0 && r.after.hunger < r.before.hunger);
});

test('feeding uses inventory, respects favourites and fullness', () => {
  const game = makeGame('wolf');
  assert.equal(feedPet(game, 'meat').ok, false);
  assert.ok(buyFood(game, 'meat').ok);
  assert.equal(game.coins, 100 - FOODS.meat.price);
  game.pet.needs.hunger = 40;
  const res = feedPet(game, 'meat');
  assert.ok(res.ok);
  assert.equal(res.preference, 'favorite');
  assert.equal(game.inventory.meat, 0);
  game.pet.needs.hunger = 99;
  game.inventory.fish = 1;
  assert.equal(feedPet(game, 'fish').ok, false);
});

test('care actions have cooldowns and sleep blocks other care', () => {
  const pet = createPet('grizzly');
  const now = Date.now();
  assert.ok(performCare(pet, 'cuddle', now).ok);
  assert.equal(performCare(pet, 'cuddle', now + 1000).ok, false);
  pet.needs.energy = 50;
  assert.ok(performCare(pet, 'sleep', now).ok);
  assert.equal(performCare(pet, 'play', now + 1000).ok, false);
});

test('training raises stats up to the per-level cap', () => {
  const pet = createPet('wolf');
  const before = getStats(pet).atk;
  const r = completeTraining(pet, 'strength', [1, 1, 1]);
  assert.ok(r.gain > 0);
  assert.ok(getStats(pet).atk > before);
  for (let i = 0; i < 50; i++) {
    pet.needs = { hunger: 100, energy: 100, happiness: 100, hygiene: 100, health: 100 };
    completeTraining(pet, 'strength', [1, 1, 1]);
    pet.level = 1; // keep the cap fixed for this test
  }
  assert.ok(pet.trained.atk <= trainingCap(pet, 'strength') + 1e-9);
});

test('training simulator grades hits', () => {
  const sim = new TrainingSim({ reps: 3 });
  sim.pos = sim.zone.center;
  assert.equal(sim.hit(), 'perfect');
  sim.pos = sim.zone.center > 0.5 ? 0 : 1;
  assert.equal(sim.hit(), 'miss');
  sim.hit();
  assert.ok(sim.done);
  assert.equal(sim.qualities.length, 3);
});

test('leveling carries over XP', () => {
  const pet = createPet('eagle');
  const levels = addXp(pet, xpToNext(1) + 5);
  assert.equal(levels, 1);
  assert.equal(pet.level, 2);
  assert.equal(pet.xp, 5);
});

test('battles always finish and every matchup is winnable', () => {
  const wins = {};
  for (const a of SPECIES_ORDER) {
    for (const b of SPECIES_ORDER) {
      let aWins = 0;
      for (let i = 0; i < 400; i++) {
        const battle = createBattle(createFighter(createPet(a), 'player'), createFighter(createPet(b), 'enemy'));
        let guard = 0;
        while (!battle.over) {
          playRound(battle, chooseBotAbility(battle.player, battle.enemy), chooseBotAbility(battle.enemy, battle.player));
          assert.ok(++guard < 100, 'battle did not end');
        }
        if (battle.winner === 'player') aWins++;
      }
      wins[`${a} vs ${b}`] = aWins / 400;
    }
  }
  for (const [k, rate] of Object.entries(wins)) {
    if (k.split(' vs ')[0] === k.split(' vs ')[1]) continue;
    assert.ok(rate > 0.2 && rate < 0.8, `${k} win rate ${rate.toFixed(2)} is too lopsided`);
  }
  console.log('  win rates (row species as player):', Object.fromEntries(Object.entries(wins).map(([k, v]) => [k, v.toFixed(2)])));
});

test('bots scale with difficulty', () => {
  const pet = createPet('wolf');
  pet.level = 5;
  assert.equal(generateBot(pet, 'easy').level, 4);
  assert.ok(generateBot(pet, 'hard').level >= 7);
  for (const ex of EXERCISE_ORDER) assert.ok(generateBot(pet, 'hard').trained[EXERCISES[ex].stat] > 0);
});

test('trophies unlock arena tiers for good', () => {
  const game = makeGame();
  game.record = { wins: 0, losses: 0, streak: 0, bestStreak: 0, trophies: 0, bestTrophies: 0 };
  const fight = (difficultyId, winner) => applyBattleResult(game, { winner, difficultyId, enemy: { level: 1 } });

  assert.equal(highestUnlocked(game.record), 'easy');
  assert.throws(() => startBattle(game, generateBot(game.pet, 'normal'), 'normal'), /locked/);
  assert.deepEqual(nextTier(game.record), { id: 'normal', at: 50, need: 50 });

  // losses never go below zero
  assert.equal(fight('easy', 'enemy').trophies, 0);

  let unlocked = [];
  const winsNeeded = Math.ceil(TROPHY_RULES.unlock.normal / TROPHY_RULES.win.easy);
  for (let i = 0; i < winsNeeded; i++) unlocked.push(...fight('easy', 'player').unlocked);
  assert.deepEqual(unlocked, ['normal']);
  assert.equal(highestUnlocked(game.record), 'normal');

  // dropping back under the threshold keeps the tier open
  const r = fight('normal', 'enemy');
  assert.equal(r.trophies, -TROPHY_RULES.loss);
  assert.ok(game.record.trophies < TROPHY_RULES.unlock.normal);
  assert.ok(isTierUnlocked(game.record, 'normal'));

  while (!isTierUnlocked(game.record, 'hard')) fight('normal', 'player');
  assert.equal(nextTier(game.record), null);
  assert.equal(fight('hard', 'player').trophies, TROPHY_RULES.win.hard);
});
