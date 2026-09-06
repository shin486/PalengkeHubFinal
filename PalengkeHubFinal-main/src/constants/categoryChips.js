// src/constants/categoryChips.js
// Single source of truth for how a product category is illustrated —
// previously HomeScreen.js and CategoryProductsScreen.js each kept
// their own hand-maintained copy of this (icon name, description) with
// a comment insisting they "match exactly", which is exactly the kind
// of convention that silently drifts: HomeScreen's category chips got
// real illustrations + tinted circles at some point and
// CategoryProductsScreen's header never did, so tapping a chip landed
// on a visually different icon for the same category.
//
// `categoryName` must stay the exact English string — both screens
// filter/compare against it (`.eq('category', categoryName)` in
// CategoryProductsScreen, `categoryName` route param from HomeScreen).
// `tone` picks the icon circle's tint from the app's existing semantic
// tokens (tokens.js: success/warning/info), not new colors —
// 'neutral' is the existing wicker/orange treatment. `image` is the
// design system's own illustration for that category
// (design-directions/assets/generated/illustrations); 'Other' has none
// there either, so it keeps the Ionicons fallback everywhere.
export const CATEGORY_CHIPS = [
  {
    categoryName: 'Vegetables', tagalog: 'Gulay', english: 'Vegetables',
    icon: 'leaf', tone: 'success',
    image: require('../assets/categories/ill-cat-vegetables.png'),
    description: 'Fresh vegetables from Lipa City Public Market',
  },
  {
    categoryName: 'Meat', tagalog: 'Karne', english: 'Meat',
    icon: 'restaurant', tone: 'neutral',
    image: require('../assets/categories/ill-cat-meat.png'),
    description: 'Premium meat cuts from trusted vendors',
  },
  {
    categoryName: 'Fruits', tagalog: 'Prutas', english: 'Fruits',
    icon: 'basket', tone: 'warning',
    image: require('../assets/categories/ill-cat-fruits.png'),
    description: 'Sweet and fresh fruits from the market',
  },
  {
    categoryName: 'Poultry', tagalog: 'Manok', english: 'Poultry',
    icon: 'egg', tone: 'info',
    image: require('../assets/categories/ill-cat-poultry.png'),
    description: 'Farm fresh poultry products',
  },
  {
    categoryName: 'Rice', tagalog: 'Bigas', english: 'Rice',
    icon: 'cafe', tone: 'neutral',
    image: require('../assets/categories/ill-cat-rice.png'),
    description: 'Daily rice essentials from local suppliers',
  },
  {
    categoryName: 'Other', tagalog: 'Iba pa', english: 'Other',
    icon: 'apps', tone: 'neutral', image: null,
    description: 'More products from Lipa City Public Market',
  },
];

export const CATEGORY_CHIPS_BY_NAME = CATEGORY_CHIPS.reduce((acc, c) => {
  acc[c.categoryName] = c;
  return acc;
}, {});

export const CATEGORY_TONES = {
  neutral: { bg: (c) => c.wickerSoft, icon: (c) => c.primaryDark },
  success: { bg: (c) => c.successLight, icon: (c) => c.success },
  warning: { bg: (c) => c.warningLight, icon: (c) => c.warning },
  info: { bg: (c) => c.infoLight, icon: (c) => c.info },
};
