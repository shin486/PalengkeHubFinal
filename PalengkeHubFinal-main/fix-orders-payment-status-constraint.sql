-- =====================================================
-- Fix: orders.payment_status check constraint rejects the values the
-- app actually writes.
--
-- The live constraint only allows a handful of values (confirmed by
-- probing: pending/paid/expired/failed/awaiting_payment succeed) but
-- the real payment flow writes three others that all get rejected:
--   - 'awaiting_verification'  (CheckoutContent.js, when a customer
--     uploads their GCash receipt — src/components/CheckoutContent.js)
--   - 'verified'               (VendorOrdersScreen.js, when a vendor
--     approves a payment — handleApprovePayment)
--   - 'rejected'               (VendorOrdersScreen.js, when a vendor
--     rejects a payment — handleRejectPayment)
--
-- Net effect before this fix: a customer submitting their GCash
-- receipt fails silently at the database with a 400/23514, and a
-- vendor approving or rejecting a payment fails the same way — the
-- entire payment-verification step of the order flow cannot complete
-- in the live database, regardless of how correct the app code is.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

alter table public.orders drop constraint if exists orders_payment_status_check;

alter table public.orders add constraint orders_payment_status_check
  check (payment_status in (
    'pending',
    'awaiting_payment',
    'awaiting_verification',
    'verified',
    'paid',
    'rejected',
    'refunded',
    'expired',
    'failed',
    'cancelled'
  ));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.orders'::regclass
  and conname = 'orders_payment_status_check';
