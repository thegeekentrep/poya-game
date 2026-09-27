/**
 * Food catalog. `short` is the tile label on phones (6 letters max so it fits the pixel font). `effects` are need deltas (see pets/needs.js).
 * Species food preferences live in pets/species.js.
 */
export const FOODS = {
  meat: { name: 'Raw Meat', short: 'Meat', price: 15, desc: 'Hearty protein for carnivores.', effects: { hunger: 32, energy: 5 } },
  fish: { name: 'Fresh Fish', short: 'Fish', price: 12, desc: 'Light and tasty.', effects: { hunger: 26, happiness: 4 } },
  berries: { name: 'Wild Berries', short: 'Berry', price: 6, desc: 'A cheap, sweet snack.', effects: { hunger: 12, happiness: 5 } },
  bananas: { name: 'Banana Bunch', short: 'Banana', price: 8, desc: 'Filling fruit.', effects: { hunger: 22, happiness: 4 } },
  honey: { name: 'Honeycomb', short: 'Honey', price: 18, desc: 'Sticky, sweet energy.', effects: { hunger: 14, happiness: 14, energy: 10 } },
  protein: {
    name: 'Protein Chow', short: 'Chow',
    price: 25,
   
    desc: 'Athlete feed. Next training session gives +30% gains.',
    effects: { hunger: 30, energy: 12 },
    buff: { trainingBoost: 1 },
  },
  treat: { name: 'Pixel Treat', short: 'Treat', price: 10, desc: 'Not filling, but pure joy.', effects: { hunger: 5, happiness: 18 } },
  medicine: {
    name: 'Herbal Medicine', short: 'Meds',
    price: 30,
   
    desc: 'Cures sickness. Tastes awful.',
    effects: { health: 45, happiness: -6 },
    medicine: true,
  },
};

export const FOOD_ORDER = ['meat', 'fish', 'berries', 'bananas', 'honey', 'protein', 'treat', 'medicine'];
