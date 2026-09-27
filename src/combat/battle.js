/**
 * Turn-based battle engine. Pure logic: playRound() mutates the battle and
 * returns a list of events for the UI to play back. Nothing here touches the DOM.
 *
 * Event: { text, kind, actor?, target?, amount?, hp: { player, enemy } }
 * kind : round | use | hit | crit | miss | dot | heal | status | faint | end
 */
import { getStats, getSpecies, getLoadout } from '../pets/pet.js';
import { ABILITIES } from './abilities.js';
import { EFFECTS, EFFECT_TUNING as T, addEffect, removeEffect, hasEffect } from './effects.js';
import { clamp, rand } from '../core/utils.js';

export const BATTLE_RULES = {
  maxRounds: 30,
  baseAccuracy: 0.95,
  damageScale: 1.6,
  defenseConstant: 40, // damage × 40 / (40 + DEF)
  damageVariance: 0.1,
  speedJitter: 0.1, // turn order randomness
  bleedAtkRatio: 0.42,
  minHitChance: 0.25,
  speedEvasionPerPoint: 0.01,
  maxSpeedEvasion: 0.2,
  baseEvasion: 0.03,
};

export function createFighter(pet, side, moodMult = 1) {
  const sp = getSpecies(pet);
  const stats = getStats(pet);
  return {
    side,
    name: pet.name,
    species: pet.species,
    level: pet.level,
    stats,
    maxHp: stats.hp,
    hp: stats.hp,
    critMult: stats.critMult,
    passive: sp.passive,
    moodMult,
    abilities: getLoadout(pet),
    cooldowns: {},
    effects: {},
  };
}

export function createBattle(player, enemy, meta = {}) {
  return { player, enemy, round: 1, over: false, winner: null, ...meta };
}

export const cooldownLeft = (f, abilityId) => f.cooldowns[abilityId] || 0;
export const isReady = (f, abilityId) => cooldownLeft(f, abilityId) <= 0;
export const opponentOf = (b, f) => (f === b.player ? b.enemy : b.player);
export const speedOf = (f) => f.stats.spd * (hasEffect(f, 'rooted') ? T.rootedSpeedMult : 1) * (f.effects.haste?.mult ?? 1);

export function playRound(b, playerMove, enemyMove) {
  const events = [];
  const emit = (text, kind = 'info', extra = {}) =>
    events.push({ text, kind, ...extra, hp: { player: b.player.hp, enemy: b.enemy.hp } });
  if (b.over) return events;

  emit(`Round ${b.round}`, 'round');
  for (const [actor, move] of turnOrder(b, playerMove, enemyMove)) {
    if (b.over) break;
    if (hasEffect(actor, 'stun')) {
      removeEffect(actor, 'stun');
      emit(`${actor.name} is stunned and can't move!`, 'status', { target: actor.side });
      continue;
    }
    useAbility(b, actor, move, emit);
    checkEnd(b, emit);
  }
  if (!b.over) endOfRound(b, emit);

  b.round += 1;
  if (!b.over && b.round > BATTLE_RULES.maxRounds) {
    const pPct = b.player.hp / b.player.maxHp;
    const ePct = b.enemy.hp / b.enemy.maxHp;
    finish(b, pPct > ePct ? 'player' : 'enemy', emit, 'Time is up! The judges decide.');
  }
  return events;
}

function turnOrder(b, playerMove, enemyMove) {
  const j = BATTLE_RULES.speedJitter;
  const ps = speedOf(b.player) * rand(1 - j, 1 + j);
  const es = speedOf(b.enemy) * rand(1 - j, 1 + j);
  const p = [b.player, playerMove];
  const e = [b.enemy, enemyMove];
  return ps >= es ? [p, e] : [e, p];
}

function useAbility(b, user, abilityId, emit) {
  if (!ABILITIES[abilityId] || !user.abilities.includes(abilityId) || !isReady(user, abilityId)) {
    abilityId = user.abilities[0];
  }
  const ability = ABILITIES[abilityId];
  const target = opponentOf(b, user);
  if (ability.cooldown > 0) user.cooldowns[abilityId] = ability.cooldown + 1; // +1: this round's tick
  emit(`${user.name} uses ${ability.name}!`, 'use', { actor: user.side, ability: abilityId });
  ability.use(makeContext(user, target, emit));
}

function makeContext(user, target, emit) {
  const ctx = {
    user,
    target,
    attack: (opts = {}) => performAttack(user, target, opts, emit),
    addEffect: (f, id, turns, data) => {
      addEffect(f, id, turns, data);
      emit(`${f.name} ${EFFECTS[id].onApply}`, 'status', { target: f.side, effect: id });
    },
    log: (text) => emit(text, 'status', { target: user.side }),
    reveal: (f) => {
      if (!hasEffect(f, 'stealth')) return;
      removeEffect(f, 'stealth');
      emit(`${f.name} is revealed!`, 'status', { target: f.side, revealed: true });
    },
    /** Several separate attacks; stops early if the target faints. Returns total damage. */
    multiHit: (count, opts = {}) => {
      let total = 0;
      for (let i = 0; i < count && target.hp > 0; i++) total += performAttack(user, target, opts, emit).damage || 0;
      return total;
    },
    heal: (f, amount) => {
      const heal = Math.min(Math.round(amount), f.maxHp - f.hp);
      if (heal <= 0) return;
      f.hp += heal;
      emit(`${f.name} recovers ${heal} HP.`, 'heal', { target: f.side, amount: heal });
    },
    /** Removes every debuff from a fighter. */
    cleanse: (f) => {
      const debuffs = Object.keys(f.effects).filter((id) => EFFECTS[id].kind === 'debuff');
      debuffs.forEach((id) => removeEffect(f, id));
      if (debuffs.length) emit(`${f.name} shakes off ${debuffs.map((id) => EFFECTS[id].label).join(', ')}!`, 'status', { target: f.side });
    },
    /** Strips every buff from a fighter. */
    dispel: (f) => {
      const buffs = Object.keys(f.effects).filter((id) => EFFECTS[id].kind === 'buff');
      buffs.forEach((id) => removeEffect(f, id));
      if (buffs.length) emit(`${f.name} loses ${buffs.map((id) => EFFECTS[id].label).join(', ')}!`, 'status', { target: f.side, revealed: buffs.includes('stealth') });
    },
    bleed: (f, turns) => {
      const dmg = Math.max(1, Math.round(user.stats.atk * BATTLE_RULES.bleedAtkRatio * (user.passive.dotMult || 1)));
      ctx.addEffect(f, 'bleed', turns, { dmg });
    },
  };
  return ctx;
}

function hitChance(att, def, opts) {
  const R = BATTLE_RULES;
  const acc =
    R.baseAccuracy +
    (opts.accuracyMod || 0) +
    (hasEffect(att, 'focus') ? T.focusAccuracy : 0) -
    (hasEffect(att, 'blind') ? T.blindPenalty : 0);
  let eva = 0;
  if (!hasEffect(def, 'marked') && !hasEffect(def, 'rooted')) {
    eva =
      clamp(R.baseEvasion + (speedOf(def) - speedOf(att)) * R.speedEvasionPerPoint, 0, R.maxSpeedEvasion) +
      (def.passive.evasion || 0) +
      (hasEffect(def, 'focus') ? T.focusEvasion : 0);
  }
  return clamp(acc - eva, R.minHitChance, 1);
}

function critChance(att, opts) {
  return clamp(att.stats.crit + (opts.critBonus || 0) + (hasEffect(att, 'focus') ? T.focusCrit : 0), 0, 0.95);
}

function baseDamage(att, def, opts) {
  const R = BATTLE_RULES;
  const atk = att.stats.atk * (att.effects.weaken?.mult ?? 1) * (att.effects.empower?.mult ?? 1) * att.moodMult;
  const defense = def.stats.def * (def.effects.guard?.mult ?? 1) * (def.effects.expose?.mult ?? 1) * (1 - (opts.armorPen || 0));
  return atk * (opts.power ?? 1) * R.damageScale * (R.defenseConstant / (R.defenseConstant + defense));
}

function performAttack(att, def, opts, emit) {
  const ambush = hasEffect(att, 'stealth');
  if (ambush) removeEffect(att, 'stealth');

  if (hasEffect(def, 'stealth') && !opts.canHitStealth) {
    emit(`${def.name} is hidden. The attack finds nothing!`, 'miss', { target: def.side });
    return { hit: false };
  }
  if (!ambush && Math.random() > hitChance(att, def, opts)) {
    emit(`${def.name} dodges!`, 'miss', { target: def.side });
    return { hit: false };
  }

  const crit = ambush || Math.random() < critChance(att, opts);
  let dmg = baseDamage(att, def, opts);
  if (crit) dmg *= att.critMult + (opts.critMultBonus || 0);
  if (hasEffect(def, 'marked')) dmg *= T.markedDamageMult;
  dmg *= 1 - (def.passive.damageReduction || 0);
  dmg *= rand(1 - BATTLE_RULES.damageVariance, 1 + BATTLE_RULES.damageVariance);
  dmg = Math.max(1, Math.round(dmg));
  def.hp = Math.max(0, def.hp - dmg);

  const prefix = ambush ? 'Ambush! ' : '';
  emit(
    crit ? `${prefix}CRITICAL! ${def.name} takes ${dmg} damage!` : `${def.name} takes ${dmg} damage.`,
    crit ? 'crit' : 'hit',
    { target: def.side, amount: dmg },
  );
  opts.onHit?.({ damage: dmg, crit });
  return { hit: true, damage: dmg, crit };
}

function endOfRound(b, emit) {
  const both = [b.player, b.enemy];
  for (const f of both) {
    if (f.effects.bleed && f.hp > 0) {
      const dmg = f.effects.bleed.dmg;
      f.hp = Math.max(0, f.hp - dmg);
      emit(`${f.name} bleeds for ${dmg}.`, 'dot', { target: f.side, amount: dmg });
    }
    if (f.effects.regen && f.hp > 0) {
      const heal = Math.min(f.effects.regen.heal, f.maxHp - f.hp);
      if (heal > 0) {
        f.hp += heal;
        emit(`${f.name} recovers ${heal} HP.`, 'heal', { target: f.side, amount: heal });
      }
    }
  }
  checkEnd(b, emit);

  for (const f of both) {
    for (const [id, effect] of Object.entries(f.effects)) {
      if (id === 'stun') continue;
      effect.turns -= 1;
      if (effect.turns <= 0) delete f.effects[id];
    }
    for (const id of Object.keys(f.cooldowns)) {
      if (f.cooldowns[id] > 0) f.cooldowns[id] -= 1;
    }
  }
}

function checkEnd(b, emit) {
  if (b.over) return;
  if (b.enemy.hp <= 0) finish(b, 'player', emit);
  else if (b.player.hp <= 0) finish(b, 'enemy', emit);
}

function finish(b, winner, emit, reason) {
  b.over = true;
  b.winner = winner;
  if (reason) emit(reason, 'info');
  const loser = winner === 'player' ? b.enemy : b.player;
  const champ = winner === 'player' ? b.player : b.enemy;
  if (loser.hp <= 0) emit(`${loser.name} faints!`, 'faint', { target: loser.side });
  emit(`${champ.name} wins!`, 'end', { actor: champ.side });
}

/** Lets a player give up; counts as a loss. */
export function forfeit(b) {
  b.over = true;
  b.winner = 'enemy';
  b.forfeited = true;
}
