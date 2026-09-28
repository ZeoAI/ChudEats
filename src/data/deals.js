const DEAL_CATEGORIES = [
  {
    id: 'asian',
    label: 'Asian and Pan-Asian',
    description: 'Fast, fresh bowls, noodles, and shareable favorites.',
    items: [
      { name: 'Panda Express', offer: 'Browse current restaurant offers' },
      { name: "P.F. Chang's", offer: 'Browse current restaurant offers' },
      { name: 'Pick Up Stix', offer: 'Browse current restaurant offers' },
    ],
  },
  {
    id: 'pizza',
    label: 'Pizza',
    description: 'Pizza night picks with rotating local promos.',
    items: [
      { name: 'Papa Johns', offer: 'Browse current restaurant offers' },
      { name: "Domino's", offer: 'Browse current restaurant offers' },
      { name: "Johnny's Pizza", offer: 'Browse current restaurant offers' },
      { name: "Marco's Pizza", offer: 'Browse current restaurant offers' },
      { name: 'Cicis Pizza', offer: 'Browse current restaurant offers' },
      { name: 'Blaze Pizza', offer: 'Browse current restaurant offers' },
    ],
  },
  {
    id: 'snacks',
    label: 'Snacks and Drinks',
    description: 'Sweet treats, smoothies, and quick pick-me-ups.',
    items: [
      { name: "Auntie Anne's", offer: 'Browse current restaurant offers' },
      { name: 'Insomnia Cookies', offer: 'Browse current restaurant offers' },
      { name: 'Smoothie King', offer: 'Browse current restaurant offers' },
      { name: 'Dairy Queen', offer: 'Browse current restaurant offers' },
      { name: 'Playa Bowls', offer: 'Browse current restaurant offers' },
      { name: 'Tropical Smoothie Cafe', offer: 'Browse current restaurant offers' },
    ],
  },
  {
    id: 'fast-food',
    label: 'Fast Food and Quick Eats',
    description: 'A wide mix of quick meals for every craving.',
    items: [
      { name: 'Five Guys', offer: 'Browse current restaurant offers' },
      { name: 'Shake Shack', offer: 'Browse current restaurant offers' },
      { name: "Jersey Mike's", offer: 'Browse current restaurant offers' },
      { name: 'Charleys', offer: 'Browse current restaurant offers' },
      { name: 'CAVA', offer: 'Browse current restaurant offers' },
      { name: "Applebee's", offer: 'Browse current restaurant offers' },
      { name: 'Jamba', offer: 'Browse current restaurant offers' },
      { name: 'Smashburger', offer: 'Browse current restaurant offers' },
      { name: 'Wienerschnitzel', offer: 'Browse current restaurant offers' },
      { name: 'Cinnabon', offer: 'Browse current restaurant offers' },
      { name: 'Which Wich', offer: 'Browse current restaurant offers' },
      { name: 'Habit Burger', offer: 'Browse current restaurant offers' },
      { name: "Moe's", offer: 'Browse current restaurant offers' },
      { name: "Schlotzsky's", offer: 'Browse current restaurant offers' },
      { name: 'Del Taco', offer: 'Browse current restaurant offers' },
      { name: 'Steak N Shake', offer: 'Browse current restaurant offers' },
      { name: 'Jollibee', offer: 'Browse current restaurant offers' },
      { name: "Jimmy John's", offer: 'Browse current restaurant offers' },
      { name: 'Wayback Burger', offer: 'Browse current restaurant offers' },
      { name: "Church's Chicken", offer: 'Browse current restaurant offers' },
      { name: 'Texas Roadhouse', offer: 'Browse current restaurant offers' },
      { name: 'IHOP', offer: 'Browse current restaurant offers' },
      { name: "Carl's Jr.", offer: 'Browse current restaurant offers' },
    ],
  },
  {
    id: 'movies',
    label: 'Movies',
    description: 'Movie nights with member-only pricing.',
    items: [
      { name: 'Harkins Theatres', offer: '60% off movies and 65% off food' },
    ],
  },
];

function getCategory(categoryId, customItems = {}) {
  const category = DEAL_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) return null;
  const additions = Array.isArray(customItems[categoryId]) ? customItems[categoryId] : [];
  return { ...category, items: [...category.items, ...additions] };
}

module.exports = { DEAL_CATEGORIES, getCategory };
