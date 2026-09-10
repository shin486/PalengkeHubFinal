-- =====================================================
-- Regression from fix-notifications-rls.sql (earlier this session): that
-- fix locked the notifications INSERT policy down to three cases — self,
-- admin, and vendor-notifying-their-own-customer (order status updates,
-- promotions) — but missed the reverse direction entirely: a customer
-- placing a new order needs to notify the VENDOR too. That almost
-- certainly happens via a database trigger firing on the orders table
-- (nothing in CheckoutContent.js inserts a notification for the vendor
-- directly), running inside the SAME transaction as the order insert —
-- so when that trigger's own notification insert got rejected by the
-- too-narrow policy, the entire order insert failed with it. Confirmed
-- live: placing an order errored with exactly "new row violates
-- row-level security policy for table notifications", and no order was
-- ever created.
--
-- Fix: add the missing symmetric case — a consumer may notify a vendor
-- (owns a stall), the same broad-but-role-bounded shape already used for
-- the vendor-to-consumer direction (see that file's own reasoning: exact
-- relationship-checking here risks the same fragility that already broke
-- things once, and notifications are informational only, not a money/
-- security-bearing channel).
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

select policyname, cmd, with_check
from pg_policies where tablename = 'notifications' and cmd = 'INSERT';

drop policy if exists "Self, vendor-to-customer, or admin can insert" on public.notifications;

create policy "Self, vendor<->consumer, or admin can insert"
  on public.notifications for insert
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or (
      exists (select 1 from public.stalls s where s.vendor_id = auth.uid())
      and exists (select 1 from public.profiles p where p.id = notifications.user_id and p.role = 'consumer')
    )
    or (
      exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'consumer')
      and exists (select 1 from public.stalls s where s.vendor_id = notifications.user_id)
    )
  );

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select policyname, cmd, with_check
from pg_policies where tablename = 'notifications' and cmd = 'INSERT';
