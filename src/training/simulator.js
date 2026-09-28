/**
 * Grades shared by every training mini-game (training/games.js, logChop.js,
 * gloveBlock.js, mathQuiz.js): each checkpoint is perfect, good or a miss.
 */
export const GRADES = {
  perfect: { label: 'PERFECT!', quality: 1 },
  good: { label: 'Good', quality: 0.6 },
  miss: { label: 'Miss...', quality: 0.1 },
};
