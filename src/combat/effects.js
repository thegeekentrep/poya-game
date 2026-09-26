/**
 * Status effects. Durations count down at the end of each round,
 * except `stun`, which is consumed when the stunned fighter skips an action.
 */
export const EFFECTS = {
  stealth: { label: 'Stealth', kind: 'buff', onApply: 'melts into the shadows!', desc: 'Normal attacks miss. Next attack is a guaranteed critical.' },
  focus: { label: 'Scouting', kind: 'buff', onApply: 'soars high and scouts the field!', desc: '+20% accuracy, +15% evasion, +20% crit chance.' },
  guard: { label: 'Guard', kind: 'buff', onApply: 'braces up! (DEF up)', desc: 'Defense increased.' },
  regen: { label: 'Regen', kind: 'buff', onApply: 'digs in and starts recovering.', desc: 'Heals at the end of each turn.' },
  stun: { label: 'Stunned', kind: 'debuff', onApply: 'is stunned!', desc: 'Loses the next action.' },
  bleed: { label: 'Bleeding', kind: 'debuff', onApply: 'is bleeding!', desc: 'Takes damage at the end of each turn, ignoring defense.' },
  marked: { label: 'Tracked', kind: 'debuff', onApply: 'has been tracked by scent!', desc: 'Cannot hide or evade. Takes +20% damage.' },
  weaken: { label: 'Weakened', kind: 'debuff', onApply: 'is intimidated! (ATK down)', desc: 'Attack reduced.' },
  blind: { label: 'Blinded', kind: 'debuff', onApply: 'is blinded!', desc: '−30% accuracy.' },
  rooted: { label: 'Grappled', kind: 'debuff', onApply: 'is pinned down!', desc: 'Speed halved. Cannot hide or evade.' },
};

export const EFFECT_TUNING = {
  focusAccuracy: 0.2,
  focusEvasion: 0.15,
  focusCrit: 0.2,
  blindPenalty: 0.3,
  markedDamageMult: 1.2,
  rootedSpeedMult: 0.5,
};

export const hasEffect = (fighter, id) => Boolean(fighter.effects[id]);

export function addEffect(fighter, id, turns, data = {}) {
  fighter.effects[id] = { ...data, turns };
}

export function removeEffect(fighter, id) {
  delete fighter.effects[id];
}
