/**
 * Bot opponents: generation by difficulty, plus the move-picking AI.
 */
import { createPet, knownMoves, LOADOUT_SIZE } from '../pets/pet.js';
import { SPECIES_ORDER } from '../pets/species.js';
import { STAT_GAIN } from '../training/exercises.js';
import { statCap } from '../training/trainer.js';
import { ABILITIES } from './abilities.js';
import { isReady } from './battle.js';
import { pick, rand, randInt, shuffle } from '../core/utils.js';

export const DIFFICULTIES = {
  easy: { label: 'Rookie', desc: 'A younger, lightly trained rival.', levelOffset: -1, levelJitter: 0, trainFactor: 0.15, moodMult: 0.95, rewardMult: 0.7 },
  normal: { label: 'Contender', desc: 'An even match for your pet.', levelOffset: 0, levelJitter: 0, trainFactor: 0.4, moodMult: 1, rewardMult: 1 },
  hard: { label: 'Champion', desc: 'A seasoned, well-trained fighter.', levelOffset: 2, levelJitter: 1, trainFactor: 0.75, moodMult: 1.05, rewardMult: 1.7 },
};
export const DIFFICULTY_ORDER = ['easy', 'normal', 'hard'];

const BOT_NAMES = ['Fang', 'Rocky', 'Talon', 'Bruiser', 'Shadow', 'Kodiak', 'Storm', 'Brutus', 'Ember', 'Ghost', 'Titan', 'Scar', 'Havoc', 'Onyx', 'Blaze', 'Maple'];

/** How much randomness the AI adds on top of each ability's score. */
const AI_NOISE = 1.2;

export function generateBot(playerPet, difficultyId = 'normal') {
  const d = DIFFICULTIES[difficultyId];
  const bot = createPet(pick(SPECIES_ORDER), pick(BOT_NAMES));
  bot.level = Math.max(1, playerPet.level + d.levelOffset + randInt(0, d.levelJitter));
  for (const stat of Object.keys(STAT_GAIN)) {
    bot.trained[stat] = statCap(bot, stat) * d.trainFactor * rand(0.6, 1);
  }
  const [basic, ...rest] = knownMoves(bot);
  bot.loadout = [basic, ...shuffle(rest).slice(0, LOADOUT_SIZE - 1)];
  bot.isBot = true;
  return bot;
}

export function chooseBotAbility(self, foe) {
  const ready = self.abilities.filter((id) => isReady(self, id));
  let best = ready[0];
  let bestScore = -Infinity;
  for (const id of ready) {
    const score = ABILITIES[id].ai(self, foe) + Math.random() * AI_NOISE;
    if (score > bestScore) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}
