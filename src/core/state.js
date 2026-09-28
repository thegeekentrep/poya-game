/**
 * The single source of truth for the save file: player, pet, wallet, pantry, record.
 * Everything is plain JSON so it can go straight into localStorage.
 */
import { CONFIG } from './config.js';
import { createPet, hydratePet } from '../pets/pet.js';

function freshState() {
  return {
    version: 1,
    player: null, // { username, createdAt }
    pet: null,
    coins: CONFIG.STARTING_COINS,
    inventory: { ...CONFIG.STARTING_INVENTORY },
    record: { wins: 0, losses: 0, streak: 0, bestStreak: 0, trophies: 0, bestTrophies: 0 },
    trainingDifficulty: 'normal', // last difficulty picked in the training yard
    lastSeen: Date.now(),
  };
}

export const game = freshState();

function replaceState(next) {
  for (const key of Object.keys(game)) delete game[key];
  Object.assign(game, next);
}

/** Returns true when a save with a pet was found. */
export function loadGame() {
  try {
    const raw = localStorage.getItem(CONFIG.SAVE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    const base = freshState();
    // Saves from before trophies existed: credit past wins so earned tiers stay open.
    if (saved.record && saved.record.trophies === undefined) {
      saved.record.trophies = (saved.record.wins || 0) * 10;
      saved.record.bestTrophies = saved.record.trophies;
    }
    replaceState({
      ...base,
      ...saved,
      record: { ...base.record, ...saved.record },
      pet: saved.pet ? hydratePet(saved.pet) : null,
    });
    return Boolean(game.pet);
  } catch (err) {
    console.warn('[POYA] Could not load save:', err);
    return false;
  }
}

export function saveGame() {
  game.lastSeen = Date.now();
  try {
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(game));
  } catch (err) {
    console.warn('[POYA] Could not save:', err);
  }
}

export function resetGame({ keepPlayer = false } = {}) {
  const player = keepPlayer ? game.player : null;
  replaceState({ ...freshState(), player });
  saveGame();
}

export function setPlayer(username) {
  game.player = { username, createdAt: Date.now() };
  saveGame();
}

export function adoptPet(speciesId, name) {
  const base = freshState();
  game.pet = createPet(speciesId, name);
  game.coins = base.coins;
  game.inventory = base.inventory;
  game.record = base.record;
  saveGame();
  return game.pet;
}
