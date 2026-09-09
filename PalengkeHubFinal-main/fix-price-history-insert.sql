-- =====================================================
-- price_history's INSERT policy (create-price-history-table.sql) is
-- `with check (true)` for any authenticated user — no product
-- ownership check, no requirement that the row actually reflects a
-- real price change. The table exists specifically so admin can spot
-- price-manipulation patterns (Price Monitoring dashboard); as-is,
-- ANY authenticated account can plant fabricated history against ANY
-- product — including a competitor's — polluting the exact evidence
-- trail meant to catch that kind of manipulation, or misattribute a
-- fake change to an arbitrary changed_by user.
--
-- The table doesn't need a client-facing INSERT policy at all: every
-- real row is written by record_price_change(), a SECURITY DEFINER
-- trigger that fires automatically on every products UPDATE. That
-- function runs as its owner (not the calling session), so it's
-- unaffected by removing this policy — dropping it just closes the
-- direct-client path while the real trigger keeps working exactly as
-- before.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename = 'price_history'
order by cmd;

drop policy if exists "Authenticated can insert price history" on public.price_history;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
-- Only the SELECT policy should remain — no INSERT/UPDATE/DELETE
-- policy means those are closed to every client role by default,
-- while the SECURITY DEFINER trigger keeps writing real rows.
select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename = 'price_history'
order by cmd, policyname;
