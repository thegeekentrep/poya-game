/**
 * Food catalog. `effects` are need deltas (see pets/needs.js).
 * Species food preferences live in pets/species.js.
 */
export const FOODS = {
  meat: { name: 'Raw Meat', price: 15, color: 'var(--c-red)', desc: 'Hearty protein for carnivores.', effects: { hunger: 32, energy: 5 } },
  fish: { name: 'Fresh Fish', price: 12, color: 'var(--c-sky)', desc: 'Light and tasty.', effects: { hunger: 26, happiness: 4 } },
  berries: { name: 'Wild Berries', price: 6, color: 'var(--c-plum)', desc: 'A cheap, sweet snack.', effects: { hunger: 12, happiness: 5 } },
  bananas: { name: 'Banana Bunch', price: 8, color: 'var(--c-yellow)', desc: 'Filling fruit.', effects: { hunger: 22, happiness: 4 } },
  honey: { name: 'Honeycomb', price: 18, color: 'var(--c-orange)', desc: 'Sticky, sweet energy.', effects: { hunger: 14, happiness: 14, energy: 10 } },
  protein: {
    name: 'Protein Chow',
    price: 25,
    color: 'var(--c-light)',
    desc: 'Athlete feed. Next training session gives +30% gains.',
    effects: { hunger: 30, energy: 12 },
    buff: { trainingBoost: 1 },
  },
  treat: { name: 'Pixel Treat', price: 10, color: 'var(--c-lime)', desc: 'Not filling, but pure joy.', effects: { hunger: 5, happiness: 18 } },
  medicine: {
    name: 'Herbal Medicine',
    price: 30,
    color: 'var(--c-green)',
    desc: 'Cures sickness. Tastes awful.',
    effects: { health: 45, happiness: -6 },
    medicine: true,
  },
};

export const FOOD_ORDER = ['meat', 'fish', 'berries', 'bananas', 'honey', 'protein', 'treat', 'medicine'];
