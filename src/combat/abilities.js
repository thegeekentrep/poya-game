/**
 * Every combat move in the game.
 *
 * cooldown : rounds you must wait before using it again (0 = always ready)
 * use(ctx) : performs the move. ctx gives you:
 *              ctx.user / ctx.target          the two fighters
 *              ctx.attack(opts)               power, armorPen, critBonus, critMultBonus,
 *                                             accuracyMod, canHitStealth, onHit()
 *              ctx.addEffect(fighter, id, turns, data)
 *              ctx.bleed(fighter, turns)
 *              ctx.reveal(fighter)            removes stealth
 *              ctx.multiHit(count, opts)      several attacks in a row; returns total damage
 *              ctx.heal(fighter, amount)
 *              ctx.dispel(fighter)            strips all buffs
 *              ctx.cleanse(fighter)           removes all debuffs
 *              ctx.log(text)                  adds a line to the battle log
 * ai(self, foe) : how much the bot wants to use this move right now (higher = more)
 */
import { hasEffect } from './effects.js';

const hpPct = (f) => f.hp / f.maxHp;

export const ABILITIES = {
  // ── Wolf: stealth, vertical mobility, critical damage ─────────────
  bite: {
    name: 'Bite',
    cooldown: 0,
    desc: 'A quick, reliable bite. 100% power.',
    use: (c) => c.attack({ power: 1 }),
    ai: () => 1,
  },
  shadow_stalk: {
    name: 'Shadow Stalk',
    cooldown: 4,
    desc: 'Vanish for 2 turns. Normal attacks miss you, and your next attack is an unmissable critical. Fails while Tracked or Grappled.',
    use: (c) => {
      if (hasEffect(c.user, 'marked') || hasEffect(c.user, 'rooted')) return c.log(`${c.user.name} can't shake off the enemy to hide!`);
      c.addEffect(c.user, 'stealth', 2);
    },
    ai: (self) => (hasEffect(self, 'stealth') || hasEffect(self, 'marked') || hasEffect(self, 'rooted') ? 0 : 3),
  },
  cliff_pounce: {
    name: 'Cliff Pounce',
    cooldown: 1,
    desc: 'Leap down from high ground: 130% power and ignores 30% of defense.',
    use: (c) => c.attack({ power: 1.3, armorPen: 0.3 }),
    ai: (self) => (hasEffect(self, 'stealth') ? 4 : 2.6),
  },
  go_for_the_throat: {
    name: 'Go for the Throat',
    cooldown: 2,
    desc: '110% power, doubled against targets below 40% HP. Criticals deal +50% extra.',
    use: (c) => c.attack({ power: hpPct(c.target) < 0.4 ? 2.2 : 1.1, critMultBonus: 0.5 }),
    ai: (self, foe) => (hpPct(foe) < 0.4 ? 5 : 1.6),
  },

  howl: {
    name: 'Howl',
    cooldown: 3,
    desc: 'A rousing howl: your ATK +40% for 3 turns.',
    use: (c) => c.addEffect(c.user, 'empower', 4, { mult: 1.4 }),
    ai: (self) => (hasEffect(self, 'empower') ? 0 : 2.2),
  },
  crippling_bite: {
    name: 'Crippling Bite',
    cooldown: 2,
    desc: 'Bite the foreleg: 105% power and the target\'s ATK −20% for 3 turns.',
    use: (c) => c.attack({ power: 1.05, onHit: () => c.addEffect(c.target, 'weaken', 3, { mult: 0.8 }) }),
    ai: (self, foe) => (hasEffect(foe, 'weaken') ? 1.2 : 2.4),
  },
  scent_mask: {
    name: 'Scent Mask',
    cooldown: 4,
    desc: 'Roll in the mud: removes all your debuffs (even Tracked and Grappled), then hide for 1 turn.',
    use: (c) => {
      c.cleanse(c.user);
      c.addEffect(c.user, 'stealth', 1);
    },
    ai: (self) => (hasEffect(self, 'marked') || hasEffect(self, 'rooted') ? 4.5 : hasEffect(self, 'stealth') ? 0 : 1.2),
  },
  hamstring: {
    name: 'Hamstring',
    cooldown: 2,
    desc: 'Go for the legs: 110% power and the target\'s DEF −30% for 4 turns.',
    use: (c) => c.attack({ power: 1.1, onHit: () => c.addEffect(c.target, 'expose', 4, { mult: 0.7 }) }),
    ai: (self, foe) => (hasEffect(foe, 'expose') ? 1 : 2.6),
  },
  feral_rush: {
    name: 'Feral Rush',
    cooldown: 2,
    desc: 'Two quick bites at 75% power each. Each one can crit.',
    use: (c) => c.multiHit(2, { power: 0.75 }),
    ai: () => 2.5,
  },
  vanishing_strike: {
    name: 'Vanishing Strike',
    cooldown: 3,
    desc: 'Hit and fade: 110% power, then melt into the shadows for 1 turn. Fails to hide while Tracked or Grappled.',
    use: (c) => {
      c.attack({ power: 1.1 });
      if (!hasEffect(c.user, 'marked') && !hasEffect(c.user, 'rooted') && c.target.hp > 0) c.addEffect(c.user, 'stealth', 1);
    },
    ai: (self) => (hasEffect(self, 'stealth') ? 0.5 : 2.7),
  },
  blood_frenzy: {
    name: 'Blood Frenzy',
    cooldown: 3,
    desc: '120% power and heal for half the damage dealt.',
    use: (c) => c.attack({ power: 1.2, onHit: ({ damage }) => c.heal(c.user, damage * 0.5) }),
    ai: (self) => (hpPct(self) < 0.6 ? 3.8 : 1.8),
  },
  alpha_howl: {
    name: 'Alpha Howl',
    cooldown: 4,
    desc: 'Assert dominance: target ATK −25% and your ATK +30% for 3 turns.',
    use: (c) => {
      c.addEffect(c.target, 'weaken', 4, { mult: 0.75 });
      c.addEffect(c.user, 'empower', 4, { mult: 1.3 });
    },
    ai: (self, foe) => (hasEffect(foe, 'weaken') || hasEffect(self, 'empower') ? 0.3 : 2.6),
  },
  lunar_fang: {
    name: 'Lunar Fang',
    cooldown: 4,
    desc: 'The finishing bite: 200% power and +25% crit chance.',
    use: (c) => c.attack({ power: 2, critBonus: 0.25 }),
    ai: () => 3.6,
  },

  // ── Gorilla: high health, crowd control ───────────────────────────
  pummel: {
    name: 'Pummel',
    cooldown: 0,
    desc: 'Heavy fists. 100% power.',
    use: (c) => c.attack({ power: 1 }),
    ai: () => 1,
  },
  ground_slam: {
    name: 'Ground Slam',
    cooldown: 3,
    desc: 'Shake the earth: 90% power and stuns the target (they lose their next action).',
    use: (c) => c.attack({ power: 0.9, onHit: () => c.addEffect(c.target, 'stun', 1) }),
    ai: (self, foe) => (hasEffect(foe, 'stun') ? 0.2 : 3.5),
  },
  chest_beat: {
    name: 'Chest Beat',
    cooldown: 3,
    desc: 'Intimidate: target ATK −25% and your DEF +40% for 3 turns.',
    use: (c) => {
      c.addEffect(c.target, 'weaken', 3, { mult: 0.75 });
      c.addEffect(c.user, 'guard', 3, { mult: 1.4 });
    },
    ai: (self, foe) => (hasEffect(foe, 'weaken') ? 0.3 : 2.8),
  },
  grapple: {
    name: 'Grapple',
    cooldown: 2,
    desc: 'Grab and pin: 80% power, catches hidden targets, halves their speed and evasion for 2 turns.',
    use: (c) =>
      c.attack({
        power: 0.8,
        canHitStealth: true,
        onHit: () => {
          c.reveal(c.target);
          c.addEffect(c.target, 'rooted', 2);
        },
      }),
    ai: (self, foe) => (hasEffect(foe, 'stealth') ? 6 : hasEffect(foe, 'rooted') ? 0.5 : 2.4),
  },

  brace: {
    name: 'Brace',
    cooldown: 2,
    desc: 'Jab from behind raised arms: 80% power and DEF +50% for 3 turns.',
    use: (c) => {
      c.attack({ power: 0.8 });
      c.addEffect(c.user, 'guard', 4, { mult: 1.5 });
    },
    ai: (self) => (hasEffect(self, 'guard') ? 0.8 : 2.4),
  },
  knuckle_rush: {
    name: 'Knuckle Rush',
    cooldown: 2,
    desc: 'Charge on all fours: two blows at 70% power each.',
    use: (c) => c.multiHit(2, { power: 0.7 }),
    ai: () => 2.5,
  },
  troop_call: {
    name: 'Troop Call',
    cooldown: 4,
    desc: 'Call the troop: removes all your debuffs, heals 10% of max HP and ATK +35% for 3 turns.',
    use: (c) => {
      c.cleanse(c.user);
      c.heal(c.user, c.user.maxHp * 0.1);
      c.addEffect(c.user, 'empower', 4, { mult: 1.35 });
    },
    ai: (self) => (Object.keys(self.effects).some((id) => ['weaken', 'blind', 'expose', 'rooted', 'marked', 'bleed'].includes(id)) ? 3.8 : hasEffect(self, 'empower') ? 0 : 2),
  },
  boulder_toss: {
    name: 'Boulder Toss',
    cooldown: 2,
    desc: 'Hurl a rock: 140% power, slightly less accurate.',
    use: (c) => c.attack({ power: 1.4, accuracyMod: -0.1 }),
    ai: () => 2.6,
  },
  jungle_roar: {
    name: 'Jungle Roar',
    cooldown: 3,
    desc: 'A deafening roar that shakes the ground: 60% power, target DEF −30% and blinded for 3 turns.',
    use: (c) =>
      c.attack({
        power: 0.6,
        onHit: () => {
          c.addEffect(c.target, 'expose', 4, { mult: 0.7 });
          c.addEffect(c.target, 'blind', 3);
        },
      }),
    ai: (self, foe) => (hasEffect(foe, 'expose') ? 0.8 : 2.6),
  },
  banana_snack: {
    name: 'Banana Snack',
    cooldown: 4,
    desc: 'A quick snack mid-fight: heal 22% of max HP.',
    use: (c) => c.heal(c.user, c.user.maxHp * 0.22),
    ai: (self) => (hpPct(self) < 0.5 ? 4.5 : hpPct(self) < 0.8 ? 1 : 0),
  },
  hammer_fist: {
    name: 'Hammer Fist',
    cooldown: 3,
    desc: 'Both fists down: 120% power, 40% chance to stun.',
    use: (c) => c.attack({ power: 1.2, onHit: () => Math.random() < 0.4 && c.addEffect(c.target, 'stun', 1) }),
    ai: () => 2.9,
  },
  iron_hide: {
    name: 'Iron Hide',
    cooldown: 4,
    desc: 'Harden up: DEF +60% and regenerate 5% max HP per turn for 3 turns.',
    use: (c) => {
      c.addEffect(c.user, 'guard', 3, { mult: 1.6 });
      c.addEffect(c.user, 'regen', 3, { heal: Math.round(c.user.maxHp * 0.05) });
    },
    ai: (self) => (hasEffect(self, 'guard') ? 0.2 : hpPct(self) < 0.65 ? 3.8 : 1),
  },
  silverback_fury: {
    name: 'Silverback Fury',
    cooldown: 4,
    desc: 'An unstoppable flurry: three blows at 60% power each.',
    use: (c) => c.multiHit(3, { power: 0.6 }),
    ai: () => 3.5,
  },

  // ── Grizzly: damage over time, tracking, attrition ────────────────
  swipe: {
    name: 'Swipe',
    cooldown: 0,
    desc: 'Claw swipe. 100% power, 30% chance to cause bleeding for 2 turns.',
    use: (c) => c.attack({ power: 1, onHit: () => Math.random() < 0.3 && c.bleed(c.target, 2) }),
    ai: () => 1,
  },
  maul: {
    name: 'Maul',
    cooldown: 1,
    desc: 'Tear deep: 80% power and bleeding for 3 turns (bleed ignores defense).',
    use: (c) => c.attack({ power: 0.8, onHit: () => c.bleed(c.target, 3) }),
    ai: (self, foe) => (hasEffect(foe, 'bleed') ? 1.5 : 3),
  },
  track_scent: {
    name: 'Track Scent',
    cooldown: 3,
    desc: 'Lock on for 4 turns: the target cannot hide or evade and takes +20% damage. Breaks stealth.',
    use: (c) => {
      c.reveal(c.target);
      c.addEffect(c.target, 'marked', 4);
    },
    ai: (self, foe) => (hasEffect(foe, 'marked') ? 0 : hasEffect(foe, 'stealth') ? 6 : foe.stats.spd > self.stats.spd ? 3.8 : 2.4),
  },
  endure: {
    name: 'Endure',
    cooldown: 3,
    desc: 'Dig in: regenerate 8% max HP per turn and +20% DEF for 3 turns.',
    use: (c) => {
      c.addEffect(c.user, 'regen', 3, { heal: Math.round(c.user.maxHp * 0.08) });
      c.addEffect(c.user, 'guard', 3, { mult: 1.2 });
    },
    ai: (self) => (hpPct(self) < 0.6 ? 4.5 : 0.6),
  },

  bear_hug: {
    name: 'Bear Hug',
    cooldown: 3,
    desc: 'Crush them close: 90% power, catches hidden targets and pins them for 2 turns.',
    use: (c) =>
      c.attack({
        power: 0.9,
        canHitStealth: true,
        onHit: () => {
          c.reveal(c.target);
          c.addEffect(c.target, 'rooted', 2);
        },
      }),
    ai: (self, foe) => (hasEffect(foe, 'stealth') ? 5 : hasEffect(foe, 'rooted') ? 0.5 : 2.3),
  },
  crushing_paw: {
    name: 'Crushing Paw',
    cooldown: 2,
    desc: 'A heavy downward paw: 110% power and the target\'s DEF −20% for 3 turns.',
    use: (c) => c.attack({ power: 1.1, onHit: () => c.addEffect(c.target, 'expose', 3, { mult: 0.8 }) }),
    ai: (self, foe) => (hasEffect(foe, 'expose') ? 1.6 : 2.7),
  },
  honey_break: {
    name: 'Honey Break',
    cooldown: 4,
    desc: 'A mouthful of honey: heal 18% of max HP and remove all your debuffs.',
    use: (c) => {
      c.cleanse(c.user);
      c.heal(c.user, c.user.maxHp * 0.18);
    },
    ai: (self) => (hpPct(self) < 0.55 ? 3.8 : hasEffect(self, 'bleed') || hasEffect(self, 'weaken') ? 2.2 : 0.3),
  },
  salmon_snatch: {
    name: 'Salmon Snatch',
    cooldown: 2,
    desc: 'A swipe like catching fish: 100% power and heal for 40% of the damage.',
    use: (c) => c.attack({ power: 1, onHit: ({ damage }) => c.heal(c.user, damage * 0.4) }),
    ai: (self) => (hpPct(self) < 0.7 ? 3.2 : 1.6),
  },
  rend: {
    name: 'Rend',
    cooldown: 1,
    desc: 'Tear open the wounds: 150% power against bleeding targets, 80% otherwise.',
    use: (c) => c.attack({ power: hasEffect(c.target, 'bleed') ? 1.5 : 0.8 }),
    ai: (self, foe) => (hasEffect(foe, 'bleed') ? 3.6 : 1.2),
  },
  hibernate: {
    name: 'Hibernate',
    cooldown: 5,
    desc: 'A short, deep rest: heal 25% of max HP and DEF +30% for 2 turns.',
    use: (c) => {
      c.heal(c.user, c.user.maxHp * 0.25);
      c.addEffect(c.user, 'guard', 2, { mult: 1.3 });
    },
    ai: (self) => (hpPct(self) < 0.45 ? 5 : 0.2),
  },
  rampage: {
    name: 'Rampage',
    cooldown: 2,
    desc: 'Charge recklessly: 150% power, but your DEF −20% for 2 turns.',
    use: (c) => {
      c.attack({ power: 1.5 });
      c.addEffect(c.user, 'expose', 2, { mult: 0.8 });
    },
    ai: (self) => (hpPct(self) > 0.5 ? 3 : 1.5),
  },
  frenzied_claws: {
    name: 'Frenzied Claws',
    cooldown: 3,
    desc: 'Three wild swipes at 45% power, each with a 40% chance to cause bleeding.',
    use: (c) => c.multiHit(3, { power: 0.45, onHit: () => Math.random() < 0.4 && c.bleed(c.target, 3) }),
    ai: () => 2.9,
  },
  ursine_wrath: {
    name: 'Ursine Wrath',
    cooldown: 5,
    desc: 'Wake the beast: ATK +40% and regenerate 6% max HP per turn for 3 turns.',
    use: (c) => {
      c.addEffect(c.user, 'empower', 3, { mult: 1.4 });
      c.addEffect(c.user, 'regen', 3, { heal: Math.round(c.user.maxHp * 0.06) });
    },
    ai: (self) => (hasEffect(self, 'empower') ? 0 : 3.4),
  },

  // ── Eagle: reconnaissance, aerial control, debuffs ────────────────
  talon_strike: {
    name: 'Talon Strike',
    cooldown: 0,
    desc: 'Rake with sharp talons. 100% power.',
    use: (c) => c.attack({ power: 1 }),
    ai: () => 1,
  },
  scout: {
    name: 'Scout',
    cooldown: 3,
    desc: 'Survey from above for 3 turns: +20% accuracy, +15% evasion, +20% crit. Reveals hidden foes.',
    use: (c) => {
      c.reveal(c.target);
      c.addEffect(c.user, 'focus', 3);
    },
    ai: (self, foe) => (hasEffect(foe, 'stealth') ? 6 : hasEffect(self, 'focus') ? 0 : 2.6),
  },
  dive_bomb: {
    name: 'Dive Bomb',
    cooldown: 2,
    desc: 'Plummet from the sky: 175% power, slightly less accurate.',
    use: (c) => c.attack({ power: 1.75, accuracyMod: -0.1 }),
    ai: () => 2.8,
  },
  screech: {
    name: 'Screech',
    cooldown: 3,
    desc: 'Piercing cry: target is blinded (−30% accuracy) and weakened (ATK −20%) for 2 turns.',
    use: (c) => {
      c.addEffect(c.target, 'blind', 2);
      c.addEffect(c.target, 'weaken', 2, { mult: 0.8 });
    },
    ai: (self, foe) => (hasEffect(foe, 'blind') ? 0.3 : 2.7),
  },

  gust: {
    name: 'Gust',
    cooldown: 2,
    desc: 'A blast of wind: 90% power and blows away all of the target\'s buffs (including stealth).',
    use: (c) => {
      c.dispel(c.target);
      c.attack({ power: 0.9 });
    },
    ai: (self, foe) => (Object.keys(foe.effects).some((id) => ['stealth', 'guard', 'empower', 'regen', 'focus', 'haste'].includes(id)) ? 4.5 : 1.3),
  },
  razor_wind: {
    name: 'Razor Wind',
    cooldown: 2,
    desc: 'A slicing wingbeat that never misses, even hidden foes. 100% power.',
    use: (c) => c.attack({ power: 1, accuracyMod: 1, canHitStealth: true, onHit: () => c.reveal(c.target) }),
    ai: (self, foe) => (hasEffect(foe, 'stealth') ? 5 : hasEffect(self, 'blind') ? 3 : 1.8),
  },
  updraft: {
    name: 'Updraft',
    cooldown: 4,
    desc: 'Rise above it all: removes all your debuffs, heals 22% of max HP and SPD +30% for 3 turns.',
    use: (c) => {
      c.cleanse(c.user);
      c.heal(c.user, c.user.maxHp * 0.22);
      c.addEffect(c.user, 'haste', 4, { mult: 1.3 });
    },
    ai: (self) => (Object.keys(self.effects).some((id) => ['weaken', 'blind', 'expose', 'rooted', 'marked', 'bleed'].includes(id)) || hpPct(self) < 0.5 ? 3.6 : 0.8),
  },
  tailwind: {
    name: 'Tailwind',
    cooldown: 3,
    desc: 'Ride the wind: a 90% power pass, then SPD +50% for 3 turns (act first, evade more).',
    use: (c) => {
      c.attack({ power: 0.9 });
      c.addEffect(c.user, 'haste', 4, { mult: 1.5 });
    },
    ai: (self) => (hasEffect(self, 'haste') ? 0.8 : 2.4),
  },
  feather_flurry: {
    name: 'Feather Flurry',
    cooldown: 2,
    desc: 'Four razor feathers at 35% power each.',
    use: (c) => c.multiHit(4, { power: 0.35 }),
    ai: () => 2.5,
  },
  eagle_eye: {
    name: 'Eagle Eye',
    cooldown: 3,
    desc: 'Strike the weak point: 85% power, catches hidden foes, and the target\'s DEF −35% for 3 turns.',
    use: (c) =>
      c.attack({
        power: 0.85,
        canHitStealth: true,
        onHit: () => {
          c.reveal(c.target);
          c.addEffect(c.target, 'expose', 4, { mult: 0.65 });
        },
      }),
    ai: (self, foe) => (hasEffect(foe, 'stealth') ? 5 : hasEffect(foe, 'expose') ? 0.8 : 2.6),
  },
  thermal_glide: {
    name: 'Thermal Glide',
    cooldown: 4,
    desc: 'Circle on warm air: heal 15% of max HP, then 5% per turn for 3 turns.',
    use: (c) => {
      c.heal(c.user, c.user.maxHp * 0.15);
      c.addEffect(c.user, 'regen', 3, { heal: Math.round(c.user.maxHp * 0.05) });
    },
    ai: (self) => (hpPct(self) < 0.55 ? 4.2 : 0.3),
  },
  piercing_beak: {
    name: 'Piercing Beak',
    cooldown: 2,
    desc: 'A precise strike: 120% power, ignores 50% of defense, +20% crit chance.',
    use: (c) => c.attack({ power: 1.2, armorPen: 0.5, critBonus: 0.2 }),
    ai: () => 2.9,
  },
  storm_dive: {
    name: 'Storm Dive',
    cooldown: 5,
    desc: 'Plunge out of a storm cloud: 220% power, less accurate, stuns on hit.',
    use: (c) => c.attack({ power: 2.2, accuracyMod: -0.15, onHit: () => c.addEffect(c.target, 'stun', 1) }),
    ai: () => 3.8,
  },

  // ── Station moves: any species, earned through training mastery ──
  shoulder_charge: {
    name: 'Shoulder Charge',
    cooldown: 2,
    desc: 'Boulder Moving. Drive in with your whole body: 125% power, ignores 25% of defense.',
    use: (c) => c.attack({ power: 1.25, armorPen: 0.25 }),
    ai: () => 2.5,
  },
  second_wind: {
    name: 'Second Wind',
    cooldown: 4,
    desc: 'Boulder Moving. Dig deep: heal 20% of max HP.',
    use: (c) => c.heal(c.user, c.user.maxHp * 0.2),
    ai: (self) => (hpPct(self) < 0.5 ? 4.5 : hpPct(self) < 0.75 ? 1 : 0),
  },
  focus_breath: {
    name: 'Focus Breath',
    cooldown: 4,
    desc: 'Waterfall. Breathe like under the falls: removes all your debuffs and regenerate 5% max HP per turn for 3 turns.',
    use: (c) => {
      c.cleanse(c.user);
      c.addEffect(c.user, 'regen', 4, { heal: Math.round(c.user.maxHp * 0.05) });
    },
    ai: (self) => (Object.keys(self.effects).some((id) => ['weaken', 'blind', 'expose', 'rooted', 'marked', 'bleed'].includes(id)) || hpPct(self) < 0.6 ? 3.4 : 0.5),
  },
  torrent_crash: {
    name: 'Torrent Crash',
    cooldown: 3,
    desc: 'Waterfall. Come down like a waterfall: 140% power, 30% chance to stun.',
    use: (c) => c.attack({ power: 1.4, onHit: () => Math.random() < 0.3 && c.addEffect(c.target, 'stun', 1) }),
    ai: () => 3,
  },
  combo_strike: {
    name: 'Combo Strike',
    cooldown: 2,
    desc: 'Striking Log. Three drilled blows at 45% power each.',
    use: (c) => c.multiHit(3, { power: 0.45 }),
    ai: () => 2.4,
  },
  log_splitter: {
    name: 'Log Splitter',
    cooldown: 4,
    desc: 'Striking Log. The blow that splits the post: 180% power.',
    use: (c) => c.attack({ power: 1.8 }),
    ai: () => 3.4,
  },
  parry: {
    name: 'Parry',
    cooldown: 2,
    desc: 'Punch Glove. Knock the blow aside and answer: 90% power and DEF +40% for 3 turns.',
    use: (c) => {
      c.attack({ power: 0.9 });
      c.addEffect(c.user, 'guard', 4, { mult: 1.4 });
    },
    ai: (self) => (hasEffect(self, 'guard') ? 0.8 : 2.3),
  },
  counterpunch: {
    name: 'Counterpunch',
    cooldown: 3,
    desc: 'Punch Glove. Hits harder the more you\'ve been hurt: 80% power, up to 200% at low HP.',
    use: (c) => c.attack({ power: 0.8 + 1.2 * (1 - hpPct(c.user)) }),
    ai: (self) => 1.5 + 3 * (1 - hpPct(self)),
  },
  quick_step: {
    name: 'Quick Step',
    cooldown: 2,
    desc: 'Running. Dart in and out: 95% power and SPD +40% for 3 turns.',
    use: (c) => {
      c.attack({ power: 0.95 });
      c.addEffect(c.user, 'haste', 4, { mult: 1.4 });
    },
    ai: (self) => (hasEffect(self, 'haste') ? 0.8 : 2.3),
  },
  blitz: {
    name: 'Blitz',
    cooldown: 3,
    desc: 'Running. Two full-speed passes at 80% power each.',
    use: (c) => c.multiHit(2, { power: 0.8 }),
    ai: () => 3,
  },
  analyze: {
    name: 'Analyze',
    cooldown: 3,
    desc: 'Classroom. Study the foe: reveals hidden foes, target DEF −35% for 3 turns, and you get Focused for 3 turns (+20% accuracy, +15% evasion, +20% crit).',
    use: (c) => {
      c.reveal(c.target);
      c.addEffect(c.target, 'expose', 4, { mult: 0.65 });
      c.addEffect(c.user, 'focus', 4);
    },
    ai: (self, foe) => (hasEffect(foe, 'stealth') ? 5 : hasEffect(foe, 'expose') ? 0.3 : 2.4),
  },
  master_plan: {
    name: 'Master Plan',
    cooldown: 5,
    desc: 'Classroom. Put the lessons together: a 70% power strike, then ATK +40% and DEF +40% for 3 turns.',
    use: (c) => {
      c.attack({ power: 0.7 });
      c.addEffect(c.user, 'empower', 4, { mult: 1.4 });
      c.addEffect(c.user, 'guard', 4, { mult: 1.4 });
    },
    ai: (self) => (hasEffect(self, 'empower') ? 0 : 2.8),
  },
};
