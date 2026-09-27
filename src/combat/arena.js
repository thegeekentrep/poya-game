/**
 * The arena: who may fight, what fighting costs, and what you win.
 */
import { createFighter, createBattle } from './battle.js';
import { DIFFICULTIES } from './bots.js';
import { applyNeedDeltas, isAsleep } from '../pets/needs.js';
import { getMood } from '../pets/mood.js';
import { addXp, movesLearnedSince } from '../pets/pet.js';
import { DIFFICULTY_ORDER } from './bots.js';

/**
 * Trophies: won in the arena, lost on defeat. Reaching `unlock` opens a tier for good
 * (it is checked against your best-ever count, so a losing streak never locks you out).
 */
export const TROPHY_RULES = {
  win: { easy: 10, normal: 15, hard: 25 },
  loss: 5,
  unlock: { easy: 0, normal: 50, hard: 150 },
};

export const isTierUnlocked = (record, difficultyId) => record.bestTrophies >= TROPHY_RULES.unlock[difficultyId];

/** The next locked tier and how many trophies it still needs, or null when all are open. */
export function nextTier(record) {
  const id = DIFFICULTY_ORDER.find((d) => !isTierUnlocked(record, d));
  return id ? { id, at: TROPHY_RULES.unlock[id], need: TROPHY_RULES.unlock[id] - record.bestTrophies } : null;
}

/** The hardest tier the player may pick. */
export const highestUnlocked = (record) => DIFFICULTY_ORDER.filter((d) => isTierUnlocked(record, d)).at(-1);

export const ARENA_RULES = {
  cost: { energy: -20, hunger: -8, hygiene: -10 },
  minEnergy: 20,
  minHealth: 35,
  win: { coinsBase: 25, coinsPerLevel: 6, xpBase: 35, xpPerLevel: 10, needs: { happiness: 12 } },
  loss: { coins: 5, xp: 12, needs: { happiness: -12, health: -12 } },
};

export function canBattle(pet, now = Date.now()) {
  if (isAsleep(pet, now)) return { ok: false, reason: `${pet.name} is asleep.` };
  if (pet.needs.health < ARENA_RULES.minHealth) return { ok: false, reason: `${pet.name} is too sick to fight. Give medicine.` };
  if (pet.needs.energy < ARENA_RULES.minEnergy) return { ok: false, reason: `${pet.name} is too tired to fight (needs ${ARENA_RULES.minEnergy} energy).` };
  return { ok: true };
}

export function estimateRewards(enemyLevel, difficultyId) {
  const w = ARENA_RULES.win;
  const mult = DIFFICULTIES[difficultyId].rewardMult;
  return {
    coins: Math.round((w.coinsBase + enemyLevel * w.coinsPerLevel) * mult),
    xp: Math.round((w.xpBase + enemyLevel * w.xpPerLevel) * mult),
  };
}

export function startBattle(game, botPet, difficultyId) {
  if (!isTierUnlocked(game.record, difficultyId)) throw new Error(`Tier ${difficultyId} is locked`);
  const pet = game.pet;
  const moodMult = getMood(pet).mult; // mood before paying the cost
  applyNeedDeltas(pet, ARENA_RULES.cost);
  const player = createFighter(pet, 'player', moodMult);
  const enemy = createFighter(botPet, 'enemy', DIFFICULTIES[difficultyId].moodMult);
  return createBattle(player, enemy, { difficultyId });
}

export function applyBattleResult(game, battle) {
  const pet = game.pet;
  const won = battle.winner === 'player';
  const rec = game.record;
  let coins;
  let xp;
  let needs;
  if (won) {
    ({ coins, xp } = estimateRewards(battle.enemy.level, battle.difficultyId));
    needs = ARENA_RULES.win.needs;
    rec.wins += 1;
    rec.streak += 1;
    rec.bestStreak = Math.max(rec.bestStreak, rec.streak);
  } else {
    ({ coins, xp, needs } = ARENA_RULES.loss);
    rec.losses += 1;
    rec.streak = 0;
  }
  const before = rec.trophies;
  const wasOpen = DIFFICULTY_ORDER.filter((d) => isTierUnlocked(rec, d));
  rec.trophies = Math.max(0, rec.trophies + (won ? TROPHY_RULES.win[battle.difficultyId] : -TROPHY_RULES.loss));
  rec.bestTrophies = Math.max(rec.bestTrophies, rec.trophies);
  const unlocked = DIFFICULTY_ORDER.filter((d) => isTierUnlocked(rec, d) && !wasOpen.includes(d));
  const trophies = rec.trophies - before;
  game.coins += coins;
  applyNeedDeltas(pet, needs);
  const levels = addXp(pet, xp);
  const learned = movesLearnedSince(pet, pet.level - levels);
  return { won, coins, xp, levels, learned, needs, level: pet.level, trophies, unlocked };
}
