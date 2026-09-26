/**
 * Training exercises and the rules of the training yard.
 * `gain` is the stat increase for one perfect session at neutral mood.
 */
export const EXERCISES = {
  strength: { name: 'Strength', stat: 'atk', gain: 0.9, desc: 'Drag logs and tug the rope. Raises Attack.' },
  endurance: { name: 'Endurance', stat: 'hp', gain: 6, desc: 'Long hill runs. Raises Max HP.' },
  toughness: { name: 'Toughness', stat: 'def', gain: 0.7, desc: 'Brace against the sparring dummy. Raises Defense.' },
  agility: { name: 'Agility', stat: 'spd', gain: 0.7, desc: 'Obstacle course sprints. Raises Speed.' },
  precision: { name: 'Precision', stat: 'crit', gain: 0.01, desc: 'Snap at moving targets. Raises Crit chance.' },
};

export const EXERCISE_ORDER = ['strength', 'endurance', 'toughness', 'agility', 'precision'];

export const TRAINING_RULES = {
  cost: { energy: -15, hunger: -8, hygiene: -8 },
  minEnergy: 15,
  minHunger: 10,
  minHealth: 40,
  reps: 3,
  specialtyMult: 1.5,
  proteinBoostMult: 1.3,
  sessionsPerLevel: 6, // cap per stat = gain * sessionsPerLevel * level
  baseXp: 12,
  bonusXp: 18, // scaled by session quality
};
