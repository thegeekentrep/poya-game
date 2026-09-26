/**
 * Global game settings. Feature-specific balance numbers live next to their
 * feature (pets/needs.js, training/exercises.js, combat/battle.js, ...).
 */
export const CONFIG = {
  GAME_TITLE: 'POYA',
  GAME_SUBTITLE: 'Pixel Pet Arena',
  SAVE_KEY: 'poya.save.v1',

  TICK_MS: 1000,
  AUTOSAVE_EVERY_TICKS: 5,

  // Pets keep living while you're away, but slower, and only up to a cap.
  OFFLINE_CAP_MINUTES: 12 * 60,
  OFFLINE_DECAY_RATE: 0.35,

  STARTING_COINS: 120,
  STARTING_INVENTORY: { meat: 1, fish: 1, berries: 2, treat: 2 },

  USERNAME_MIN: 3,
  USERNAME_MAX: 16,
  PET_NAME_MAX: 12,
};
