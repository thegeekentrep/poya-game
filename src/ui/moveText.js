import { ABILITIES } from '../combat/abilities.js';
import { getLoadout } from '../pets/pet.js';

/** Result-screen line for a newly learned move. */
export function learnedLine(pet, id) {
  const where = getLoadout(pet).includes(id) ? 'equipped' : 'equip it in Stats';
  return `New move: ${ABILITIES[id].name}! (${where})`;
}
