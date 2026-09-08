// Real per-stall rating aggregates, computed from the actual `ratings`
// table (a publicly readable table — same one HomeScreen's "top rated
// stalls" and StallDetailsScreen/StallReviewsScreen already trust).
//
// Extracted out of HomeScreen.js so every screen that shows a stall's
// star rating computes it the same way. Before this existed, several
// screens (ProductCard callers, SearchScreen, CategoryProductsScreen)
// instead ran a seeded-random generator keyed off the stall id whenever
// stalls.average_rating was empty — which it always is, since nothing
// writes to that column. The same stall could show a different "rating"
// on every screen. This is the one real source of truth going forward.
import { supabase } from '../../lib/supabase';

// Returns { [stallId]: { average, count } } for every stall with at
// least one real rating. A stall with no ratings simply has no entry —
// callers should treat that as 0/"no reviews yet", not fall back to a
// fabricated number.
export const fetchAllStallRatings = async () => {
  const { data: ratings, error } = await supabase
    .from('ratings')
    .select('stall_id, rating')
    .limit(1000);

  if (error || !ratings) return {};

  const stats = new Map();
  for (const r of ratings) {
    if (!r.stall_id) continue;
    const s = stats.get(r.stall_id) || { count: 0, sum: 0 };
    s.count += 1;
    s.sum += parseFloat(r.rating) || 0;
    stats.set(r.stall_id, s);
  }

  const result = {};
  for (const [stallId, s] of stats.entries()) {
    result[stallId] = { average: Math.round((s.sum / s.count) * 10) / 10, count: s.count };
  }
  return result;
};
