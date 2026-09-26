/**
 * Species definitions — the "DNA" of each animal.
 *
 * base / growth : starting stats and how much each level adds
 * critMult      : damage multiplier on critical hits
 * passive       : always-on trait; numeric fields are read by combat/battle.js
 *                 (damageReduction, dotMult, evasion)
 * specialty     : exercise id (training/exercises.js) that trains 50% faster
 * favorite/disliked foods : food ids (foods/foods.js)
 * abilities     : ability ids (combat/abilities.js); the first one is the basic attack
 */
export const SPECIES = {
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    role: 'Assassin',
    tagline: 'Stealth, vertical mobility, and high critical damage.',
    lore: 'A silent hunter that strikes from the high ground and vanishes before the counterattack.',
    sound: 'Awoo',
    defaultName: 'Luna',
    base: { hp: 86, atk: 13, def: 6, spd: 13, crit: 0.15 },
    growth: { hp: 8, atk: 1.6, def: 0.6, spd: 1.0, crit: 0.005 },
    critMult: 2.0,
    passive: { name: 'Apex Instinct', desc: 'Critical hits deal 200% damage.' },
    specialty: 'precision',
    favoriteFoods: ['meat'],
    dislikedFoods: ['berries', 'bananas'],
    abilities: ['bite', 'shadow_stalk', 'cliff_pounce', 'go_for_the_throat'],
  },

  gorilla: {
    id: 'gorilla',
    name: 'Gorilla',
    role: 'Juggernaut',
    tagline: 'High health, slow movement, and immense crowd control.',
    lore: 'A silverback wall of muscle. Slow to act, but every blow shakes the whole arena.',
    sound: 'Hoo-hoo',
    defaultName: 'Kong',
    base: { hp: 165, atk: 13, def: 12, spd: 5, crit: 0.05 },
    growth: { hp: 14, atk: 1.2, def: 1.1, spd: 0.4, crit: 0.002 },
    critMult: 1.6,
    passive: { name: 'Silverback Hide', desc: 'Takes 10% less damage from attacks.', damageReduction: 0.1 },
    specialty: 'endurance',
    favoriteFoods: ['bananas', 'berries'],
    dislikedFoods: ['meat'],
    abilities: ['pummel', 'ground_slam', 'chest_beat', 'grapple'],
  },

  grizzly: {
    id: 'grizzly',
    name: 'Grizzly Bear',
    role: 'Bruiser',
    tagline: 'Damage-over-time (DoT), tracking, and attrition warfare.',
    lore: 'Never lets go of a scent. Bleeds its prey dry and simply outlasts everything.',
    sound: 'Grrr',
    defaultName: 'Bruno',
    base: { hp: 120, atk: 11, def: 9, spd: 9, crit: 0.08 },
    growth: { hp: 11, atk: 1.3, def: 0.9, spd: 0.6, crit: 0.003 },
    critMult: 1.8,
    passive: { name: 'Relentless', desc: 'Bleeding inflicted by this bear deals 30% more damage.', dotMult: 1.3 },
    specialty: 'strength',
    favoriteFoods: ['honey', 'fish'],
    dislikedFoods: ['protein'],
    abilities: ['swipe', 'maul', 'track_scent', 'endure'],
  },

  eagle: {
    id: 'eagle',
    name: 'Eagle',
    role: 'Scout',
    tagline: 'Reconnaissance, aerial control, and status debuffs.',
    lore: 'Sees everything from above. Blinds, weakens and dives when the moment is right.',
    sound: 'Skree',
    defaultName: 'Aquila',
    base: { hp: 95, atk: 13, def: 6, spd: 16, crit: 0.15 },
    growth: { hp: 7, atk: 1.4, def: 0.5, spd: 1.1, crit: 0.004 },
    critMult: 1.9,
    passive: { name: 'Sky Sovereign', desc: 'Flies above the fray: +10% evasion.', evasion: 0.1 },
    specialty: 'agility',
    favoriteFoods: ['fish'],
    dislikedFoods: ['bananas', 'berries'],
    abilities: ['talon_strike', 'scout', 'dive_bomb', 'screech'],
  },
};

export const SPECIES_ORDER = ['wolf', 'gorilla', 'grizzly', 'eagle'];
