-- =====================================================
-- "Top Products This Month" (Home screen) needs to rank products by
-- total quantity sold across ALL customers -- but `orders` is RLS-
-- locked to each consumer's own rows (see add-admin-rls-policies.sql,
-- which had to add an explicit bypass just for admins to see "all
-- orders"). A plain client-side `select items from orders` for this
-- feature silently returns 0 rows for every guest and every logged-in
-- shopper alike -- not an error, just an empty result, because RLS
-- filters rows rather than rejecting the query.
--
-- Fix: a SECURITY DEFINER function that aggregates server-side (same
-- pattern already used by record_price_change(), run_price_anomaly_
-- daily_check(), etc. in this project) and returns ONLY an anonymous
-- product_id -> sold_qty tally -- no consumer_id, no order contents,
-- nothing that would leak one shopper's purchase history to another.
-- That's safe to expose to anon + authenticated directly.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

drop function if exists public.get_top_products(timestamptz, int);

-- product_id is bigint, not uuid -- products.id is a bigint identity
-- column in this schema (confirmed by the "operator does not exist:
-- bigint = uuid" error the first version of this function produced
-- when joined against public.products).
create or replace function public.get_top_products(
  p_since timestamptz default null,
  p_limit int default 10
)
returns table(product_id bigint, sold_qty numeric)
language sql
security definer set search_path = public
stable
as $$
  select
    (item->>'id')::bigint as product_id,
    sum((item->>'quantity')::numeric) as sold_qty
  from public.orders o
  cross join lateral jsonb_array_elements(o.items) as item
  where o.status = 'completed'
    and o.items is not null
    and (p_since is null or o.created_at >= p_since)
  group by (item->>'id')::bigint
  order by sold_qty desc
  limit p_limit;
$$;

grant execute on function public.get_top_products(timestamptz, int) to anon, authenticated;

-- ── Verify ───────────────────────────────────────────────
-- All-time top sellers (what the Home screen falls back to when the
-- current calendar month has no completed orders yet, e.g. right now
-- since the UAT seed data is dated August 2026):
select p.name, t.sold_qty
from public.get_top_products(null, 10) t
join public.products p on p.id = t.product_id;

-- This calendar month only (what the Home screen prefers when available):
select p.name, t.sold_qty
from public.get_top_products(date_trunc('month', now()), 10) t
join public.products p on p.id = t.product_id;
