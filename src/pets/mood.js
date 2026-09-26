/**
 * Mood is derived from needs. It multiplies training gains and battle power,
 * so a well-cared-for pet is a stronger pet.
 */
import { isAsleep } from './needs.js';
import { getSpecies } from './pet.js';

export const MOODS = {
  sleeping: { label: 'Sleeping', mult: 1, color: 'var(--c-sky)' },
  sick: { label: 'Sick', mult: 0.6, color: 'var(--c-green)' },
  starving: { label: 'Starving', mult: 0.7, color: 'var(--c-red)' },
  exhausted: { label: 'Exhausted', mult: 0.7, color: 'var(--c-slate)' },
  miserable: { label: 'Miserable', mult: 0.8, color: 'var(--c-red)' },
  grumpy: { label: 'Grumpy', mult: 0.9, color: 'var(--c-orange)' },
  content: { label: 'Content', mult: 1, color: 'var(--c-light)' },
  happy: { label: 'Happy', mult: 1.08, color: 'var(--c-lime)' },
  ecstatic: { label: 'Ecstatic', mult: 1.15, color: 'var(--c-yellow)' },
};

const MOOD_WEIGHTS = { hunger: 0.25, happiness: 0.35, energy: 0.2, hygiene: 0.2 };

export function moodScore(pet) {
  let score = 0;
  for (const [key, w] of Object.entries(MOOD_WEIGHTS)) score += pet.needs[key] * w;
  return score;
}

export function getMoodId(pet, now = Date.now()) {
  const n = pet.needs;
  if (isAsleep(pet, now)) return 'sleeping';
  if (n.health < 40) return 'sick';
  if (n.hunger < 15) return 'starving';
  if (n.energy < 15) return 'exhausted';
  const s = moodScore(pet);
  if (s >= 85) return 'ecstatic';
  if (s >= 68) return 'happy';
  if (s >= 48) return 'content';
  if (s >= 30) return 'grumpy';
  return 'miserable';
}

export function getMood(pet, now = Date.now()) {
  const id = getMoodId(pet, now);
  return { id, ...MOODS[id] };
}

export function formatMoodMult(mult) {
  if (mult === 1) return '';
  return `${mult > 1 ? '+' : '−'}${Math.round(Math.abs(mult - 1) * 100)}%`;
}

/** What the pet is "saying" in its thought bubble. */
export function getThought(pet, now = Date.now()) {
  const n = pet.needs;
  const { sound } = getSpecies(pet);
  const mood = getMoodId(pet, now);
  if (mood === 'sleeping') return 'Zzz...';
  if (mood === 'sick') return "I don't feel so good...";
  if (mood === 'starving') return 'So... hungry...';
  if (n.hunger < 40) return 'My tummy is rumbling.';
  if (n.energy < 25) return 'I need a nap.';
  if (n.hygiene < 30) return 'I feel all muddy.';
  if (n.happiness < 35) return "I'm bored. Play with me?";
  if (mood === 'ecstatic') return `${sound}! Best day ever!`;
  const idle = [`${sound}!`, "Let's train!", 'Ready for the arena!', 'What are we doing today?'];
  return idle[Math.floor(now / 8000) % idle.length];
}
