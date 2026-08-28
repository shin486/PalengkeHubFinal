-- =====================================================
-- Fix: notifications.type check constraint rejects most of the values
-- the app actually writes.
--
-- Same class of bug as orders.payment_status (see
-- fix-orders-payment-status-constraint.sql): the constraint was
-- defined narrowly and never updated as the app's notification
-- vocabulary grew. Probed against every real code path that inserts
-- into notifications:
--
--   'order'                       ✅ allowed
--   'announcement'                ✅ allowed
--   'payment'                     ❌ rejected — vendor approve/reject
--                                    payment notifications
--                                    (VendorOrdersScreen.js,
--                                    VendorOrderDetailScreen.js)
--   'stall_location_reregister'   ❌ rejected — admin flagging a
--                                    stall for GPS re-capture
--                                    (stallLocationService.js)
--   'general'                     ❌ rejected — the DEFAULT fallback
--                                    type in the shared
--                                    createNotification() helper
--                                    (notificationService.js) — even
--                                    the fallback path was broken
--   'order_update'                ❌ rejected (notificationService.js)
--   'promotion'                   ❌ rejected (notificationService.js)
--
-- Net effect before this fix: approving or rejecting a payment
-- silently fails to notify the customer (the order status update
-- itself still succeeds — this is a secondary failure, not a
-- transaction blocker like the payment_status one was), and several
-- other notification paths fail the same way.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'order',
    'order_update',
    'payment',
    'promotion',
    'announcement',
    'stall_location_reregister',
    'general'
  ));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.notifications'::regclass
  and conname = 'notifications_type_check';
