// src/utils/priceRange.js
// A product with several unit options (kg/piece/bundle/etc. — see
// AddProductModal's Unit Prices section) can have a genuinely different
// price per unit — e.g. a small vs. big pakwan. price_options already
// carries all of them (including the base unit's own price), so the
// full spread a shopper will actually see is just its min/max.
//
// Returns null when there's nothing to range over (no price_options,
// or every option happens to cost the same) — callers should fall back
// to the product's plain single price in that case.
export const getProductPriceRange = (product) => {
  const values = product?.price_options && typeof product.price_options === 'object'
    ? Object.values(product.price_options).map(Number).filter(v => !isNaN(v) && v > 0)
    : [];
  if (!values.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  return min !== max ? { min, max } : null;
};
