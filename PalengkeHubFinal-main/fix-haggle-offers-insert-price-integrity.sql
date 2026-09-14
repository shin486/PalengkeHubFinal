-- =====================================================
-- Security review finding: fix-haggle-offers-update-policy.sql's
-- "drop everything, rebuild narrow" pass dropped a constraint it
-- didn't mean to. The ORIGINAL insert policy (add-haggle-offers-table.sql)
-- required `last_offered_by = 'customer' and status = 'pending'` --
-- a customer could only ever *propose* an offer, never insert one
-- that's already 'accepted'. The rebuilt insert policy in
-- fix-haggle-offers-update-policy.sql is just
-- `with check (auth.uid() = customer_id)`, with no such constraint.
--
-- That means a customer can INSERT a haggle_offers row directly with
-- status='accepted' and any current_price they like, for any real
-- product/vendor. enforce_order_item_prices() (see
-- fix-order-price-trigger-unit-pricing-gap.sql) treats the newest
-- 'accepted' haggle_offers row for a given customer+product+unit as
-- an authoritative, vendor-approved price that overrides the listed
-- price -- so this forged row lets the customer check out at any
-- price they choose.
--
-- Fix: restore the original insert-time constraint. Only this one
-- policy is touched -- the SELECT/UPDATE/DELETE policies from
-- fix-haggle-offers-update-policy.sql are already correct and are
-- left as-is.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

drop policy if exists "haggle_offers_insert_own" on public.haggle_offers;

create policy "haggle_offers_insert_own"
  on public.haggle_offers for insert
  with check (
    auth.uid() = customer_id
    and last_offered_by = 'customer'
    and status = 'pending'
  );

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select policyname, cmd, with_check
from pg_policies
where tablename = 'haggle_offers' and cmd = 'INSERT';
