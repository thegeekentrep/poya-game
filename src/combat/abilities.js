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
};
