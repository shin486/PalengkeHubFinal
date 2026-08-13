// Price history service — powers the "Bumaba/Tumaas ang presyo" badges.
import { supabase } from '../../lib/supabase';

/**
 * Returns Map<productId, { product_id, previous_price, new_price, changed_at }>
 * with the best available "previous price" per product:
 *
 *  1. The public.price_history table (created by the admin's Price Monitoring).
 *     If the table doesn't exist yet (PGRST205), this is skipped silently.
 *  2. Active promotions as a fallback: original_price acts as the previous
 *     price, so discounted products show the "Bumaba ang presyo" badge today.
 */
export const fetchPriceTrends = async (productIds) => {
  const ids = [...new Set((productIds || []).filter(Boolean))];
  const map = new Map();
  if (ids.length === 0) return map;

  // ── Source 1: real price change history ──
  try {
    const { data, error } = await supabase
      .from('price_history')
      .select('product_id, previous_price, new_price, changed_at')
      .in('product_id', ids)
      .order('changed_at', { ascending: false })
      .limit(600);
    if (!error && data) {
      for (const row of data) {
        if (!map.has(row.product_id)) map.set(row.product_id, row);
      }
    }
  } catch (e) {
    // table may not exist yet — ignore
  }

  // ── Source 2: active promotions (price went DOWN by definition) ──
  try {
    const now = new Date().toISOString();
    const { data: promos, error: promoError } = await supabase
      .from('promotions')
      .select('product_id, original_price, discount_type, discount_value')
      .in('product_id', ids)
      .eq('is_active', true)
      .lte('start_date', now)
      .gte('end_date', now);
    if (!promoError && promos) {
      for (const p of promos) {
        if (map.has(p.product_id)) continue;
        if (p.original_price && parseFloat(p.original_price) > 0) {
          map.set(p.product_id, {
            product_id: p.product_id,
            previous_price: p.original_price,
            new_price: null,
            changed_at: null,
          });
        }
      }
    }
  } catch (e) {
    console.warn('fetchPriceTrends (promotions) failed:', e);
  }

  return map;
};

