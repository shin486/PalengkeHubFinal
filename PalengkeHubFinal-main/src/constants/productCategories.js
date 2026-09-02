// src/constants/productCategories.js
// The one canonical list of product categories, as offered to vendors when
// adding/editing a product (AddProductModal.js). products.category stores
// the lowercase `id` (e.g. "vegetables", "rice"), not the display `label` —
// any UI reading that column raw (the admin dashboard did, before this file
// existed) shows the id instead of a properly-cased label, and has no
// mapping for ids like "rice" -> "Rice & Grains" at all.
export const CATEGORY_OPTIONS = [
  { id: 'vegetables', label: 'Vegetables', icon: 'leaf' },
  { id: 'meat', label: 'Meat', icon: 'restaurant' },
  { id: 'rice', label: 'Rice & Grains', icon: 'grain' },
  { id: 'fruits', label: 'Fruits', icon: 'nutrition' },
  { id: 'poultry', label: 'Poultry', icon: 'egg' },
  { id: 'other', label: 'Other', icon: 'construct' },
];

export const CATEGORY_LABEL_BY_ID = CATEGORY_OPTIONS.reduce((acc, c) => {
  acc[c.id] = c.label;
  return acc;
}, {});
