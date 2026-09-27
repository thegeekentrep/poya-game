/**
 * Species definitions — the "DNA" of each animal.
 *
 * base / growth : starting stats and how much each level adds
 * critMult      : damage multiplier on critical hits
 * passive       : always-on trait; numeric fields are read by combat/battle.js
 *                 (damageReduction, dotMult, evasion)
 * specialty     : exercise id (training/exercises.js) that trains 50% faster
 * favorite/disliked foods : food ids (foods/foods.js)
 * voicePitch    : base pitch (Hz) of the animal's grunts (audio/sfx.js)
 * learnset      : [level, ability id] pairs (combat/abilities.js). The 4 starting moves are
 *                 Lv 1, then one new move per level up to Lv 10. The first entry is the
 *                 basic attack, which is always equipped.
 */
export const SPECIES = {
  wolf: {
    id: 'wolf',
    name: 'Wolf',
    role: 'Assassin',
    tagline: 'Stealth, vertical mobility, and high critical damage.',
    lore: 'A silent hunter that strikes from the high ground and vanishes before the counterattack.',
    sound: 'Awoo',
    voicePitch: 170,
    defaultName: 'Luna',
    base: { hp: 86, atk: 13, def: 6, spd: 13, crit: 0.15 },
    growth: { hp: 8, atk: 1.6, def: 0.6, spd: 1.0, crit: 0.005 },
    critMult: 2.0,
    passive: { name: 'Apex Instinct', desc: 'Critical hits deal 200% damage.' },
    specialty: 'classroom',
    favoriteFoods: ['meat'],
    dislikedFoods: ['berries', 'bananas'],
    learnset: [
      [1, 'bite'],
      [1, 'shadow_stalk'],
      [1, 'cliff_pounce'],
      [1, 'go_for_the_throat'],
      [2, 'howl'],
      [3, 'crippling_bite'],
      [4, 'hamstring'],
      [5, 'feral_rush'],
      [6, 'scent_mask'],
      [7, 'vanishing_strike'],
      [8, 'blood_frenzy'],
      [9, 'alpha_howl'],
      [10, 'lunar_fang'],
    ],
  },

  gorilla: {
    id: 'gorilla',
    name: 'Gorilla',
    role: 'Juggernaut',
    tagline: 'High health, slow movement, and immense crowd control.',
    lore: 'A silverback wall of muscle. Slow to act, but every blow shakes the whole arena.',
    sound: 'Hoo-hoo',
    voicePitch: 95,
    defaultName: 'Kong',
    base: { hp: 165, atk: 13, def: 12, spd: 5, crit: 0.05 },
    growth: { hp: 14, atk: 1.2, def: 1.1, spd: 0.4, crit: 0.002 },
    critMult: 1.6,
    passive: { name: 'Silverback Hide', desc: 'Takes 10% less damage from attacks.', damageReduction: 0.1 },
    specialty: 'boulder',
    favoriteFoods: ['bananas', 'berries'],
    dislikedFoods: ['meat'],
    learnset: [
      [1, 'pummel'],
      [1, 'ground_slam'],
      [1, 'chest_beat'],
      [1, 'grapple'],
      [2, 'brace'],
      [3, 'knuckle_rush'],
      [4, 'boulder_toss'],
      [5, 'jungle_roar'],
      [6, 'banana_snack'],
      [7, 'hammer_fist'],
      [8, 'troop_call'],
      [9, 'iron_hide'],
      [10, 'silverback_fury'],
    ],
  },

  grizzly: {
    id: 'grizzly',
    name: 'Grizzly Bear',
    role: 'Bruiser',
    tagline: 'Damage-over-time (DoT), tracking, and attrition warfare.',
    lore: 'Never lets go of a scent. Bleeds its prey dry and simply outlasts everything.',
    sound: 'Grrr',
    voicePitch: 82,
    defaultName: 'Bruno',
    base: { hp: 120, atk: 11, def: 9, spd: 9, crit: 0.08 },
    growth: { hp: 11, atk: 1.3, def: 0.9, spd: 0.6, crit: 0.003 },
    critMult: 1.8,
    passive: { name: 'Relentless', desc: 'Bleeding inflicted by this bear deals 30% more damage.', dotMult: 1.3 },
    specialty: 'log',
    favoriteFoods: ['honey', 'fish'],
    dislikedFoods: ['protein'],
    learnset: [
      [1, 'swipe'],
      [1, 'maul'],
      [1, 'track_scent'],
      [1, 'endure'],
      [2, 'bear_hug'],
      [3, 'crushing_paw'],
      [4, 'salmon_snatch'],
      [5, 'rend'],
      [6, 'honey_break'],
      [7, 'rampage'],
      [8, 'hibernate'],
      [9, 'frenzied_claws'],
      [10, 'ursine_wrath'],
    ],
  },

  eagle: {
    id: 'eagle',
    name: 'Eagle',
    role: 'Scout',
    tagline: 'Reconnaissance, aerial control, and status debuffs.',
    lore: 'Sees everything from above. Blinds, weakens and dives when the moment is right.',
    sound: 'Skree',
    voicePitch: 290,
    defaultName: 'Aquila',
    base: { hp: 95, atk: 13, def: 6, spd: 16, crit: 0.15 },
    growth: { hp: 7, atk: 1.4, def: 0.5, spd: 1.1, crit: 0.004 },
    critMult: 1.9,
    passive: { name: 'Sky Sovereign', desc: 'Flies above the fray: +10% evasion.', evasion: 0.1 },
    specialty: 'running',
    favoriteFoods: ['fish'],
    dislikedFoods: ['bananas', 'berries'],
    learnset: [
      [1, 'talon_strike'],
      [1, 'scout'],
      [1, 'dive_bomb'],
      [1, 'screech'],
      [2, 'gust'],
      [3, 'razor_wind'],
      [4, 'tailwind'],
      [5, 'feather_flurry'],
      [6, 'eagle_eye'],
      [7, 'updraft'],
      [8, 'thermal_glide'],
      [9, 'piercing_beak'],
      [10, 'storm_dive'],
    ],
  },
};

export const SPECIES_ORDER = ['wolf', 'gorilla', 'grizzly', 'eagle'];
