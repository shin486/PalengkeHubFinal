// src/services/priceAnomalyService.js
// ============================================================
// PRICE ANOMALY ENFORCEMENT
// ============================================================
// Builds on priceSuggestion.js's market-average comparison (already
// used as a passive hint in AddProductModal) with a stricter, blocking
// threshold: 50% above market average is treated as a real anomaly,
// not just a suggestion. Flags recorded here feed the admin's Price
// Anomalies review list and the daily-reminder / 3-day-deactivation
// cron job (see create-price-anomaly-cron-job.sql).
// ============================================================

import { supabase } from '../../lib/supabase';
import { getPriceSuggestion, classifyPrice } from './priceSuggestion';
import { notificationService } from './notificationService';

export const ANOMALY_THRESHOLD_PCT = 50;

/**
 * Fresh market check at save time (never reuse a component's debounced
 * suggestion state — it can be stale if the vendor submits quickly).
 * Returns null when there isn't enough market data, or the price isn't
 * anomalous; otherwise { marketAvgPrice, deviationPct }.
 */
export const checkAnomaly = async (name, price) => {
  const suggestion = await getPriceSuggestion(name);
  if (!suggestion) return null;

  const classification = classifyPrice(price, suggestion);
  if (!classification || classification.diffPct < ANOMALY_THRESHOLD_PCT) return null;

  return {
    marketAvgPrice: suggestion.avg,
    deviationPct: classification.diffPct,
  };
};

/**
 * Records a vendor's own confirmed-anyway price as a pending anomaly.
 * Best-effort: the product itself is already saved by the time this
 * runs, so a failure here shouldn't read to the vendor as "my product
 * didn't save."
 */
export const flagAuto = async ({ productId, stallId, vendorId, unit, price, marketAvgPrice, deviationPct }) => {
  const { error } = await supabase.from('price_anomalies').insert({
    product_id: productId,
    stall_id: stallId,
    vendor_id: vendorId,
    unit: unit || null,
    flagged_price: price,
    market_avg_price: marketAvgPrice ?? null,
    deviation_pct: deviationPct ?? null,
    source: 'auto',
    status: 'pending',
  });
  if (error) console.warn('Failed to record price anomaly:', error.message);
};

/**
 * Admin manually flagging a product's price. Unlike flagAuto, this is
 * the primary action (not a side effect), so it throws on failure —
 * the caller should surface that to the admin.
 */
export const flagManual = async ({ productId, stallId, vendorId, productName, unit, price, marketAvgPrice, deviationPct, adminId, note }) => {
  const { error } = await supabase.from('price_anomalies').insert({
    product_id: productId,
    stall_id: stallId,
    vendor_id: vendorId,
    unit: unit || null,
    flagged_price: price,
    market_avg_price: marketAvgPrice ?? null,
    deviation_pct: deviationPct ?? null,
    source: 'admin_manual',
    status: 'pending',
    flagged_by: adminId,
    admin_note: note || null,
  });
  if (error) throw error;

  // Best-effort — sendPushNotification already swallows its own
  // errors (e.g. vendor has no push token registered).
  await notificationService.sendPushNotification(
    vendorId,
    'Price flagged by admin',
    `Admin flagged your price for ${productName} as possibly unfair. Please review and adjust it — you have 3 days before your stall is deactivated.`,
    { type: 'price_anomaly', productId }
  );
};

/**
 * Call after a vendor saves an edited price. Clears any open
 * (pending or already-deactivated) flag on this exact product if the
 * new price is no longer anomalous — the record itself is kept
 * permanently either way, only its live status changes.
 */
export const autoResolveIfCompliant = async (productId, productName, newPrice) => {
  const { data: openAnomalies } = await supabase
    .from('price_anomalies')
    .select('id')
    .eq('product_id', productId)
    .in('status', ['pending', 'deactivated']);

  if (!openAnomalies?.length) return;

  const stillAnomalous = await checkAnomaly(productName, newPrice);
  if (stillAnomalous) return;

  const { error } = await supabase
    .from('price_anomalies')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .in('id', openAnomalies.map(a => a.id));
  if (error) console.warn('Failed to auto-resolve price anomaly:', error.message);
};

export const priceAnomalyService = {
  checkAnomaly,
  flagAuto,
  flagManual,
  autoResolveIfCompliant,
  ANOMALY_THRESHOLD_PCT,
};

export default priceAnomalyService;
