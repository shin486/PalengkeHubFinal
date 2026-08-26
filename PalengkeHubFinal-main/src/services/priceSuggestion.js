// src/services/priceSuggestion.js
// ============================================================
// PRICE SUGGESTION — market-rate guidance for vendors
// ============================================================
// Compares a product's price against sibling products of the same
// name across all stalls, so vendors see if they're over/underpricing
// before they publish.
// ============================================================

import { supabase } from '../../lib/supabase';

/**
 * Fetch market stats for similarly-named products across all stalls.
 * Returns null when there isn't enough signal to advise.
 */
export const getPriceSuggestion = async (productName) => {
  const name = (productName || '').trim();
  if (name.length < 3) return null;

  try {
    const { data, error } = await supabase
      .from('products')
      .select('price, stall_id')
      .ilike('name', `%${name}%`)
      .gte('price', 0.01)
      .limit(50);

    if (error || !data?.length) return null;

    const prices = data
      .map(p => parseFloat(p.price))
      .filter(p => !isNaN(p) && p > 0);

    if (prices.length < 2) return null; // need at least 2 data points

    prices.sort((a, b) => a - b);
    return {
      count: prices.length,
      min: prices[0],
      max: prices[prices.length - 1],
      median: prices[Math.floor(prices.length / 2)],
      avg: prices.reduce((sum, p) => sum + p, 0) / prices.length,
    };
  } catch (err) {
    console.warn('getPriceSuggestion error:', err?.message);
    return null;
  }
};

/**
 * Classify a typed price against a suggestion.
 * Returns { level: 'low'|'fair'|'high', label, diffPct } or null.
 */
export const classifyPrice = (price, suggestion) => {
  const p = parseFloat(price);
  if (isNaN(p) || p <= 0 || !suggestion?.avg) return null;

  const diffPct = Math.round(((p - suggestion.avg) / suggestion.avg) * 100);

  if (diffPct > 25) {
    return { level: 'high', diffPct, label: `${diffPct}% above market average` };
  }
  if (diffPct < -25) {
    return { level: 'low', diffPct, label: `${Math.abs(diffPct)}% below market average` };
  }
  return { level: 'fair', diffPct, label: 'Within market range' };
};