// Fallback photos for products whose vendor never uploaded a picture.
// Metro requires string literal require() paths, so this map can't be built
// dynamically from a slug — every entry has to be spelled out.
const PHOTOS_BY_SLUG = {
  'apples': require('../assets/products/apples.jpg'),
  'bacon': require('../assets/products/bacon.jpg'),
  'bananas': require('../assets/products/bananas.jpg'),
  'bangus': require('../assets/products/bangus.jpg'),
  'bay-leaves': require('../assets/products/bay-leaves.jpg'),
  'beef-tenderloin': require('../assets/products/beef-tenderloin.jpg'),
  'beer': require('../assets/products/beer.jpg'),
  'black-pepper': require('../assets/products/black-pepper.jpg'),
  'brown-rice': require('../assets/products/brown-rice.jpg'),
  'cabbage': require('../assets/products/cabbage.jpg'),
  'carrots': require('../assets/products/carrots.jpg'),
  'chicken-breast': require('../assets/products/chicken-breast.jpg'),
  'chicken-wings': require('../assets/products/chicken-wings.jpg'),
  'cinnamon-sticks': require('../assets/products/cinnamon-sticks.jpg'),
  'cooking-oil': require('../assets/products/cooking-oil.jpg'),
  'duck-eggs': require('../assets/products/duck-eggs.jpg'),
  'energy-drink': require('../assets/products/energy-drink.jpg'),
  'fresh-eggs': require('../assets/products/fresh-eggs.jpg'),
  'frozen-chicken': require('../assets/products/frozen-chicken.jpg'),
  'frozen-fish-fillet': require('../assets/products/frozen-fish-fillet.jpg'),
  'frozen-pork-chop': require('../assets/products/frozen-pork-chop.jpg'),
  'galunggong': require('../assets/products/galunggong.jpg'),
  'garlic-powder': require('../assets/products/garlic-powder.jpg'),
  'garlic': require('../assets/products/garlic.jpg'),
  'ginger': require('../assets/products/ginger.jpg'),
  'glutinous-rice': require('../assets/products/glutinous-rice.jpg'),
  'ground-pork': require('../assets/products/ground-pork.jpg'),
  'hasa-hasa': require('../assets/products/hasa-hasa.jpg'),
  'hotdogs': require('../assets/products/hotdogs.jpg'),
  'juice-drinks': require('../assets/products/juice-drinks.jpg'),
  'mangoes': require('../assets/products/mangoes.jpg'),
  'mineral-water': require('../assets/products/mineral-water.jpg'),
  'mongo-beans': require('../assets/products/mongo-beans.jpg'),
  'onions': require('../assets/products/onions.jpg'),
  'oranges': require('../assets/products/oranges.jpg'),
  'pancit-canton': require('../assets/products/pancit-canton.jpg'),
  'pork-cuenco': require('../assets/products/pork-cuenco.jpg'),
  'pork-liempo': require('../assets/products/pork-liempo.jpg'),
  'pork-shoulder': require('../assets/products/pork-shoulder.jpg'),
  'premium-rice': require('../assets/products/premium-rice.jpg'),
  'pusit': require('../assets/products/pusit.jpg'),
  'quail-eggs': require('../assets/products/quail-eggs.jpg'),
  'red-beans': require('../assets/products/red-beans.jpg'),
  'salt': require('../assets/products/salt.jpg'),
  'soft-drinks': require('../assets/products/soft-drinks.jpg'),
  'soy-sauce': require('../assets/products/soy-sauce.jpg'),
  'tilapia': require('../assets/products/tilapia.jpg'),
  'tomatoes': require('../assets/products/tomatoes.jpg'),
  'vinegar': require('../assets/products/vinegar.jpg'),
  'watermelon': require('../assets/products/watermelon.jpg'),
  'whole-chicken': require('../assets/products/whole-chicken.jpg'),
};

const slugify = (name) =>
  String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Returns a require()'d image source for this product name, or null if we
// don't have a fallback for it (caller should fall back further, e.g. to a
// generic placeholder icon).
export const getProductFallbackPhoto = (productName) => {
  return PHOTOS_BY_SLUG[slugify(productName)] || null;
};
