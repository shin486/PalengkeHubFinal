// web/src/constants/productCategories.js
// Mirrors PalengkeHubFinal-main/src/constants/productCategories.js — the two
// apps are separate deployments (mobile app vs. admin web dashboard) so this
// can't be a cross-import, but the id/label pairs must stay identical.
// products.category stores the lowercase id a vendor picked (e.g.
// "vegetables", "rice"), not a display label — without this mapping the
// admin dashboard showed that raw id verbatim ("rice" instead of
// "Rice & Grains"), and had no way to render it properly cased at all.
export const CATEGORY_LABEL_BY_ID = {
  vegetables: 'Vegetables',
  meat: 'Meat',
  rice: 'Rice & Grains',
  fruits: 'Fruits',
  poultry: 'Poultry',
  other: 'Other',
};

export const categoryLabel = (idOrLabel) => {
  if (!idOrLabel) return 'Uncategorized';
  return CATEGORY_LABEL_BY_ID[idOrLabel.toLowerCase()] || idOrLabel;
};
