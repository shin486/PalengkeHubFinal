-- =====================================================
-- Extend notifications.type to allow 'price_anomaly'.
--
-- Same class of bug fix-notifications-type-constraint.sql already
-- fixed once: notifications.type has a strict CHECK constraint, and
-- any type not explicitly listed is silently rejected — the vendor
-- deactivation and daily-warning notifications the price anomaly
-- system writes would otherwise fail with no visible error (the
-- underlying action, e.g. deactivating a stall, would still succeed;
-- only the notification row would be lost).
--
-- First attempt at this migration failed on ADD CONSTRAINT — Postgres
-- validates every EXISTING row against a new CHECK constraint, and
-- live data already contained a type that fix-notifications-type-
-- constraint.sql's list (and this file's first draft) both missed:
-- 'vendor_resubmission', written by the admin web dashboard's
-- "Request Resubmission" action (web/src/pages/AdminDashboard.jsx) —
-- a separate codebase from the mobile app fix-notifications-type-
-- constraint.sql's own header comment was audited against, which is
-- how it got missed the first time. Confirmed complete this time by
-- cross-checking live data (select type, count(*) from
-- notifications group by type) against every insert site in BOTH
-- the mobile app and the web dashboard.
--
-- Run this BEFORE any app code or the price-anomaly cron job tries
-- to insert a 'price_anomaly' notification.
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
    'vendor_resubmission',
    'general',
    'price_anomaly'
  ));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.notifications'::regclass
  and conname = 'notifications_type_check';
