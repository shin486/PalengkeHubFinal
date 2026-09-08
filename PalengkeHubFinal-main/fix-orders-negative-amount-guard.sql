-- =====================================================
-- Security hardening: orders currently accept negative amounts —
-- confirmed live by inserting an order with total_amount: -999999
-- directly via the REST API (as an authenticated customer, no admin
-- needed) and having it succeed with 201. The app's own checkout flow
-- would never send a negative number, but nothing on the database
-- side stops a direct API call from doing it, and a negative
-- "completed" order would silently reduce a vendor's reported revenue
-- in VendorReportsScreen.js's totals (which just sum total_amount).
--
-- This adds the cheap, safe part of the fix — a CHECK constraint
-- rejecting negative subtotal/total_amount outright. It does NOT fix
-- the deeper issue: the database still trusts whatever item prices
-- and totals the client sends, rather than recomputing them from the
-- real products table — so a client could still submit a real
-- product at, say, ₱0.01 instead of its actual listed price. Closing
-- that fully needs a trigger (or moving order creation into a
-- database function) that reprices `items` server-side against
-- `products.price` at insert time. Flagging that as a separate,
-- larger follow-up rather than bundling it into this quick guard.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

alter table public.orders drop constraint if exists orders_subtotal_nonnegative;
alter table public.orders
  add constraint orders_subtotal_nonnegative check (subtotal >= 0);

alter table public.orders drop constraint if exists orders_total_amount_nonnegative;
alter table public.orders
  add constraint orders_total_amount_nonnegative check (total_amount >= 0);

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.orders'::regclass and contype = 'c'
  and conname like 'orders_%nonnegative';
