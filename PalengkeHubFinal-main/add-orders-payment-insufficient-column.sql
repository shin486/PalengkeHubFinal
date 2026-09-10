-- =====================================================
-- Supports the new vendor-cancels-a-paid-order dispute flow
-- (VendorOrderDetailScreen.js / OrdersScreen.js).
--
-- Today, cancelling an order (handleRejectOrder) never touches
-- payment_status — so a cancelled order whose payment_status is still
-- 'awaiting_verification' or 'verified' means the customer had already
-- paid (or submitted proof) before the vendor cancelled. That customer
-- is owed a refund and currently has zero recourse: OrdersScreen.js's
-- "Report an Issue" button only ever appears for status === 'completed'.
--
-- This column is the one thing that can't be derived from existing
-- data: whether the vendor is exempt from that because the customer's
-- own payment was short of the order total. It's set only at the
-- moment of cancellation, from a checkbox the vendor ticks in the
-- Reject Order modal — null/false means a real dispute, true means the
-- customer's own underpayment caused the cancellation (no dispute).
--
-- Pure additive column — no RLS change needed. The vendor already has
-- UPDATE rights on their own stall's orders, and the customer already
-- has SELECT rights on their own orders, so both the write (vendor
-- cancelling) and the read (customer seeing it flagged) are covered by
-- whatever policy already lets those exact roles touch this row today.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

alter table public.orders
  add column if not exists payment_insufficient boolean;

comment on column public.orders.payment_insufficient is
  'Set when a vendor cancels an order that already had payment_status awaiting_verification/verified. true = customer underpaid (no dispute owed); false = customer paid in full (dispute-eligible, see cancel_reason + notifications).';

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'orders' and column_name = 'payment_insufficient';
