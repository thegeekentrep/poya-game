import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SPECIES, SPECIES_ORDER } from '../src/pets/species.js';
import { createPet, getStats, addXp, xpToNext, hydratePet, getLoadout, setEquipped, knownMoves, LOADOUT_SIZE } from '../src/pets/pet.js';
import { tickNeeds, simulateAway } from '../src/pets/needs.js';
import { getMood } from '../src/pets/mood.js';
import { FOODS } from '../src/foods/foods.js';
import { feedPet, buyFood, feedEffects } from '../src/foods/feeding.js';
import { performCare, checkCare, tapPet, createCuddleTracker, CUDDLE_RULES } from '../src/care/care.js';
import { EXERCISES, EXERCISE_ORDER } from '../src/training/exercises.js';
import { completeTraining, statCap, trainingCost, mastery, offeredMoves, learnTrainingMove } from '../src/training/trainer.js';
import { TrainingSim } from '../src/training/simulator.js';
import { ABILITIES } from '../src/combat/abilities.js';
import { createFighter, createBattle, playRound } from '../src/combat/battle.js';
import { generateBot, chooseBotAbility, botLevelRange } from '../src/combat/bots.js';
import { TROPHY_RULES, applyBattleResult, startBattle, isTierUnlocked, nextTier, highestUnlocked } from '../src/combat/arena.js';
import { SPRITES } from '../src/sprites/animals.js';

const makeGame = (species = 'wolf') => ({ pet: createPet(species), coins: 100, inventory: {}, record: { wins: 0, losses: 0 } });

test('every species references valid abilities, foods, exercises and sprites', () => {
  for (const id of SPECIES_ORDER) {
    const sp = SPECIES[id];
    for (const [level, a] of sp.learnset) assert.ok(ABILITIES[a] && level >= 1, `${id}: ability ${a}`);
    assert.equal(new Set(sp.learnset.map(([, a]) => a)).size, sp.learnset.length, `${id}: duplicate moves`);
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

test('the food card shows what feeding will actually do', () => {
  const game = makeGame('grizzly'); // loves honey and fish, dislikes protein
  game.pet.needs.hunger = 40;
  game.pet.needs.happiness = 40;
  game.inventory.honey = 1;
  const preview = feedEffects(game.pet, 'honey');
  assert.ok(preview.happiness > FOODS.honey.effects.happiness); // favorite bonus
  assert.ok(feedEffects(game.pet, 'protein').hunger < FOODS.protein.effects.hunger); // disliked: less filling
  feedPet(game, 'honey');
  assert.equal(game.pet.needs.hunger, 40 + preview.hunger);
  assert.equal(game.pet.needs.happiness, 40 + preview.happiness);
});

test('care actions have cooldowns and sleep blocks other care', () => {
  const pet = createPet('grizzly');
  const now = Date.now();
  pet.needs.hygiene = 20;
  assert.ok(performCare(pet, 'groom', now).ok);
  assert.equal(performCare(pet, 'groom', now + 1000).ok, false);
  pet.needs.energy = 50;
  assert.ok(performCare(pet, 'sleep', now).ok);
  assert.equal(performCare(pet, 'play', now + 1000).ok, false);
});

test('mini-game quality scales groom and play rewards', () => {
  const pet = createPet('wolf');
  pet.needs.hygiene = 20;
  assert.ok(checkCare(pet, 'groom').ok);
  performCare(pet, 'groom', 0, 0.5);
  assert.equal(pet.needs.hygiene, 20 + Math.round(45 * 0.5));
  assert.equal(checkCare(pet, 'groom', 1000).ok, false); // cooldown started
  pet.needs.happiness = 40;
  pet.needs.energy = 60;
  performCare(pet, 'play', 0, 0.4);
  assert.equal(pet.needs.happiness, 40 + Math.round(18 * 0.4));
  assert.equal(pet.needs.energy, 52); // costs are paid in full
});

test('tapping the pet cuddles it, too many taps annoy it', () => {
  const pet = createPet('wolf');
  pet.needs.happiness = 50;
  const tracker = createCuddleTracker();
  let now = 1_000_000;
  const first = tapPet(pet, tracker, now);
  assert.equal(first.kind, 'cuddle');
  assert.equal(pet.needs.happiness, 50 + CUDDLE_RULES.happiness);
  assert.equal(tapPet(pet, tracker, (now += 3000)).happiness, 0); // hearts, but no stat until the reward cooldown ends
  assert.equal(tapPet(pet, tracker, (now += 3000)).kind, 'cuddle'); // slow taps never annoy
  assert.equal(tapPet(pet, tracker, (now += 3000)).happiness, CUDDLE_RULES.happiness);

  const kinds = [];
  for (let i = 0; i < 6; i++) kinds.push(tapPet(pet, tracker, (now += 300)).kind);
  assert.deepEqual(kinds, ['cuddle', 'fidget', 'fidget', 'fidget', 'annoyed', 'pester']); // the tap 3s earlier still counts
  assert.equal(tapPet(pet, tracker, (now += 3000)).kind, 'pester'); // still annoyed, and the timer restarts
  assert.equal(tapPet(pet, tracker, (now += CUDDLE_RULES.annoyedSec * 1000 + 10)).kind, 'cuddle'); // calmed down

  pet.sleepingUntil = now + 10_000;
  assert.equal(tapPet(pet, createCuddleTracker(), now).kind, 'asleep');
});

test('training raises stats up to the per-level cap', () => {
  const pet = createPet('wolf');
  const before = getStats(pet).atk;
  const beforeSpd = getStats(pet).spd;
  const r = completeTraining(pet, 'log', [1, 1, 1]);
  assert.deepEqual(r.gains.map((g) => g.stat), ['atk', 'spd']);
  assert.ok(r.gains[0].gain > r.gains[1].gain && r.gains[1].gain > 0);
  assert.ok(getStats(pet).atk > before);
  assert.ok(getStats(pet).spd > beforeSpd);
  for (let i = 0; i < 50; i++) {
    pet.needs = { hunger: 100, energy: 100, happiness: 100, hygiene: 100, health: 100 };
    completeTraining(pet, 'log', [1, 1, 1]);
    pet.level = 1; // keep the cap fixed for this test
  }
  assert.ok(pet.trained.atk <= statCap(pet, 'atk') + 1e-9);
  assert.ok(pet.trained.spd <= statCap(pet, 'spd') + 1e-9);
});

test('stamina lowers the training energy cost', () => {
  const pet = createPet('wolf');
  const base = trainingCost(pet).energy;
  pet.trained.sta = 20;
  assert.ok(trainingCost(pet).energy > base); // less negative
  pet.trained.sta = 999;
  assert.equal(trainingCost(pet).energy, Math.round(base * 0.5));
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

test('mystery opponents stay inside the level range the card shows', () => {
  const pet = createPet('wolf');
  pet.level = 6;
  for (const tier of ['easy', 'normal', 'hard']) {
    const { min, max } = botLevelRange(pet, tier);
    const species = new Set();
    for (let i = 0; i < 60; i++) {
      const bot = generateBot(pet, tier);
      assert.ok(bot.level >= min && bot.level <= max, `${tier}: Lv ${bot.level} outside ${min}-${max}`);
      species.add(bot.species);
    }
    assert.ok(species.size > 1, 'opponents are random');
  }
});

test('bots scale with difficulty', () => {
  const pet = createPet('wolf');
  pet.level = 5;
  assert.equal(generateBot(pet, 'easy').level, 4);
  assert.ok(generateBot(pet, 'hard').level >= 7);
  for (const ex of EXERCISE_ORDER) assert.ok(generateBot(pet, 'hard').trained[EXERCISES[ex].primary] > 0);
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

test('pets learn a move each level and equip up to four', () => {
  const pet = createPet('wolf');
  assert.deepEqual(getLoadout(pet), ['bite', 'shadow_stalk', 'cliff_pounce', 'go_for_the_throat']);
  addXp(pet, xpToNext(1));
  assert.equal(pet.level, 2);
  assert.ok(knownMoves(pet).includes('howl'));
  assert.ok(!getLoadout(pet).includes('howl')); // loadout is full, so it waits in Stats
  assert.equal(setEquipped(pet, 'howl', true), false);
  assert.equal(setEquipped(pet, 'bite', false), false); // basic attack stays
  assert.ok(setEquipped(pet, 'cliff_pounce', false));
  assert.ok(setEquipped(pet, 'howl', true));
  assert.deepEqual(getLoadout(pet), ['bite', 'shadow_stalk', 'go_for_the_throat', 'howl']);
  assert.ok(setEquipped(pet, 'howl', false));
  while (pet.level < 10) addXp(pet, xpToNext(pet.level));
  assert.equal(knownMoves(pet).length, 13);
  assert.equal(getLoadout(pet).length, LOADOUT_SIZE); // the free slot was filled by a new move
  assert.equal(setEquipped(createPet('wolf'), 'lunar_fang', true), false); // not learned yet
});

test('old saves without a loadout keep their original four moves', () => {
  const pet = hydratePet({ species: 'eagle', name: 'Old', level: 6 });
  assert.deepEqual(getLoadout(pet), ['talon_strike', 'scout', 'dive_bomb', 'screech']);
  assert.equal(knownMoves(pet).length, 9);
});

test('every animal has a call', async () => {
  const { CALL_SPECIES } = await import('../src/audio/animalCalls.js');
  assert.deepEqual([...CALL_SPECIES].sort(), [...SPECIES_ORDER].sort());
});

test('every move has its own combat sounds', async () => {
  const { MOVE_SOUNDS, MOVE_SFX_NAMES } = await import('../src/audio/moveSounds.js');
  const { isAttackMove } = await import('../src/sprites/moves.js');
  for (const id of Object.keys(ABILITIES)) {
    const [cast, hit] = MOVE_SOUNDS[id] ?? [];
    assert.ok(MOVE_SFX_NAMES.includes(cast), `${id}: cast sound`);
    if (isAttackMove(id)) assert.ok(MOVE_SFX_NAMES.includes(hit), `${id}: hit sound`);
  }
});

test('every learned move works in battle', () => {
  for (const id of SPECIES_ORDER) {
    const pet = createPet(id);
    pet.level = 10;
    for (const move of knownMoves(pet)) {
      const foe = createPet(id);
      foe.level = 10;
      const battle = createBattle(createFighter({ ...pet, loadout: [knownMoves(pet)[0], move] }, 'player'), createFighter(foe, 'enemy'));
      for (let r = 0; r < 3 && !battle.over; r++) {
        const events = playRound(battle, move, knownMoves(foe)[0]);
        assert.ok(events.length > 0, `${move}`);
      }
    }
  }
});

test('training mastery offers station moves (progressive overload)', () => {
  const pet = createPet('grizzly');
  const fresh = () => (pet.needs = { hunger: 100, energy: 100, happiness: 100, hygiene: 100, health: 100 });
  let breakthroughs = [];
  for (let i = 0; i < 4; i++) {
    fresh();
    pet.level = 20; // keep stat caps out of the way
    breakthroughs.push(...completeTraining(pet, 'log', [1, 1, 1]).breakthroughs);
  }
  assert.deepEqual(breakthroughs, ['combo_strike']); // 12 points after 4 perfect sessions
  assert.equal(mastery(pet, 'log').tier, 1);
  assert.deepEqual(offeredMoves(pet, 'log'), ['combo_strike']);
  assert.equal(learnTrainingMove(pet, 'log', 'log_splitter'), false); // not earned yet
  assert.ok(learnTrainingMove(pet, 'log', 'combo_strike'));
  assert.ok(knownMoves(pet).includes('combo_strike'));
  assert.deepEqual(offeredMoves(pet, 'log'), []);
  fresh();
  assert.deepEqual(completeTraining(pet, 'log', [0.1, 0.1, 0.1]).breakthroughs, []); // misses build no mastery
  assert.equal(mastery(pet, 'log').points, 12);
});

test('mastery makes the station harder', () => {
  assert.ok(new TrainingSim({ load: 2 }).speed > new TrainingSim({ load: 0 }).speed);
});

test('station moves work in battle for every species', () => {
  const stationMoves = EXERCISE_ORDER.flatMap((ex) => EXERCISES[ex].moves);
  for (const id of SPECIES_ORDER) {
    for (const move of stationMoves) {
      assert.ok(ABILITIES[move], move);
      const pet = createPet(id);
      pet.trainingMoves = [move];
      pet.loadout = [knownMoves(pet)[0], move];
      const battle = createBattle(createFighter(pet, 'player'), createFighter(createPet(id), 'enemy'));
      assert.ok(battle.player.abilities.includes(move));
      assert.ok(playRound(battle, move, knownMoves(pet)[0]).length > 0);
    }
  }
});
