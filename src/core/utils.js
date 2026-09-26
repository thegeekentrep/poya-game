export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const rand = (min = 0, max = 1) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(rand(min, max + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const signed = (v) => (v >= 0 ? `+${v}` : `−${Math.abs(v)}`);

export function formatDuration(ms) {
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const hr = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  if (d) return `${d}d ${hr}h`;
  if (hr) return `${hr}h ${min}m`;
  return `${Math.max(min, 1)}m`;
}
