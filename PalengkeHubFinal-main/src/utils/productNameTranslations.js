// Common Filipino wet-market product names -> English, for the small
// subtitle under a product name (e.g. "Kamatis" / "Tomato"). Vendors type
// product names freely, so this can only ever cover common terms, not
// every possible name — an unmapped name just means no subtitle renders,
// same graceful-miss behavior as getProductFallbackPhoto.
const TRANSLATIONS = {
  'kamatis': 'Tomato',
  'sibuyas': 'Onion',
  'bawang': 'Garlic',
  'luya': 'Ginger',
  'talong': 'Eggplant',
  'repolyo': 'Cabbage',
  'patatas': 'Potato',
  'karots': 'Carrot',
  'kalabasa': 'Squash',
  'sitaw': 'String Beans',
  'okra': 'Okra',
  'ampalaya': 'Bitter Gourd',
  'kangkong': 'Water Spinach',
  'pechay': 'Bok Choy',
  'labanos': 'Radish',
  'mais': 'Corn',

  'mangga': 'Mango',
  'saging': 'Banana',
  'papaya': 'Papaya',
  'pinya': 'Pineapple',
  'kalamansi': 'Calamansi',
  'dalandan': 'Orange',
  'pakwan': 'Watermelon',

  'baboy': 'Pork',
  'liempo': 'Pork Belly',
  'kasim': 'Pork Shoulder',
  'giniling': 'Ground Pork',
  'baka': 'Beef',
  'manok': 'Chicken',
  'pata': 'Pork Leg',
  'balat-ng-baboy': 'Pork Skin',

  'isda': 'Fish',
  'bangus': 'Milkfish',
  'tilapia': 'Tilapia',
  'galunggong': 'Round Scad',
  'pusit': 'Squid',
  'hipon': 'Shrimp',
  'alimango': 'Crab',
  'tulingan': 'Skipjack Tuna',
  'hasa-hasa': 'Short-bodied Mackerel',

  'bigas': 'Rice',
  'itlog': 'Egg',
  'gatas': 'Milk',
  'asukal': 'Sugar',
  'asin': 'Salt',
  'toyo': 'Soy Sauce',
  'suka': 'Vinegar',
  'mantika': 'Cooking Oil',
  'sibuyas-na-pula': 'Red Onion',
  'sibuyas-na-puti': 'White Onion',
  'kamote': 'Sweet Potato',
  'gabi': 'Taro',
  'monggo': 'Mung Beans',
};

const slugify = (name) =>
  String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Returns an English translation for this product name, or null if we
// don't have one (caller should just omit the subtitle in that case).
export const getProductEnglishName = (productName) => {
  return TRANSLATIONS[slugify(productName)] || null;
};
