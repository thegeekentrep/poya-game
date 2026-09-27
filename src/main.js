/**
 * Entry point: load the save, catch the pet up on time away, start the clock.
 */
import { CONFIG } from './core/config.js';
import { game, loadGame, saveGame } from './core/state.js';
import { formatDuration } from './core/utils.js';
import { NEEDS, NEED_ORDER, tickNeeds, simulateAway } from './pets/needs.js';
import { initRouter, go, tickScreen } from './ui/router.js';
import { initAudio } from './audio/audio.js';
import { setTrack } from './audio/music.js';
import { toast } from './ui/components/toast.js';
import title from './ui/screens/title.js';
import select from './ui/screens/select.js';
import home from './ui/screens/home.js';
import battle from './ui/screens/battle.js';

function awayMessage(report) {
  const drops = NEED_ORDER.map((k) => [k, report.before[k] - report.after[k]]).sort((a, b) => b[1] - a[1]);
  const [worst, amount] = drops[0];
  const detail = amount >= 5 ? ` ${NEEDS[worst].label} dropped by ${Math.round(amount)}.` : '';
  return `You were away ${formatDuration(report.awayMs)}.${detail} Check on ${game.pet.name}!`;
}

function boot() {
  const hasPet = loadGame();
  let report = null;
  if (hasPet) {
    const away = Date.now() - game.lastSeen;
    if (away > 60_000) {
      report = simulateAway(game.pet, away, { rate: CONFIG.OFFLINE_DECAY_RATE, capMinutes: CONFIG.OFFLINE_CAP_MINUTES });
      saveGame();
    }
  }

  initAudio();
  initRouter(document.getElementById('app'), { title, select, home, battle }, {
    onNavigate: (screen) => setTrack(screen === 'battle' ? 'battle' : 'camp'),
  });
  go('title');
  if (report) toast(awayMessage(report), 'info', 6000);

  // Real-time clock. Uses wall-clock deltas so throttled background tabs still age the pet.
  let last = Date.now();
  let ticks = 0;
  setInterval(() => {
    const now = Date.now();
    let elapsed = (now - last) / 1000;
    last = now;
    if (game.pet) {
      let cursor = now - elapsed * 1000;
      while (elapsed > 0) {
        const step = Math.min(60, elapsed);
        cursor += step * 1000;
        tickNeeds(game.pet, step, cursor);
        elapsed -= step;
      }
    }
    tickScreen();
    if (++ticks % CONFIG.AUTOSAVE_EVERY_TICKS === 0) saveGame();
  }, CONFIG.TICK_MS);

  // pagehide is the reliable "leaving" event on mobile browsers
  window.addEventListener('pagehide', saveGame);
  window.addEventListener('beforeunload', saveGame);
  document.addEventListener('visibilitychange', () => document.hidden && saveGame());
}

boot();

// Offline support + installability (skipped when opened as a local file).
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[POYA] Service worker failed:', err));
}
