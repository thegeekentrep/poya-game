/**
 * The arena: who may fight, what fighting costs, and what you win.
 */
import { createFighter, createBattle } from './battle.js';
import { DIFFICULTIES } from './bots.js';
import { applyNeedDeltas, isAsleep } from '../pets/needs.js';
import { getMood } from '../pets/mood.js';
import { addXp } from '../pets/pet.js';

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
  game.coins += coins;
  applyNeedDeltas(pet, needs);
  const levels = addXp(pet, xp);
  return { won, coins, xp, levels, needs, level: pet.level };
}
