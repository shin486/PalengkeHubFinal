-- =====================================================
-- notifications: same situation as conversations/messages — no
-- policy definitions in any tracked SQL file, and notificationService.js
-- relies on RLS for 100% of its access control, with two calls that
-- don't even filter by user_id in the query itself:
--
--   markAsRead(notificationId)   -> update ... where id = notificationId
--   deleteNotification(id)       -> delete ... where id = notificationId
--
-- Neither checks the row's user_id against the caller at the app
-- layer at all. If the current RLS policy on this table is as
-- permissive as the ones already found and fixed this session on
-- profiles/ratings/price_anomalies/conversations, any authenticated
-- user can mark-read or outright delete ANY other user's
-- notifications just by guessing/enumerating an id — silently
-- suppressing things like "your stall was deactivated" or "your
-- order is ready" for a target of their choosing.
--
-- Legitimate cross-user writes DO exist here (this isn't a pure
-- "own row only" table): a vendor's own session inserts a
-- notification row for a CUSTOMER's user_id when they update an
-- order status (notifyOrderStatusChange) or post a promotion
-- (notifyNewPromotion, sent to everyone who favorited that stall).
-- Precisely replicating "did this customer favorite this exact
-- stall" inside an RLS check depends on the exact shape of
-- profiles.favorites (a JSONB blob) — fragile to get exactly right
-- from outside, and getting it wrong would silently break the
-- promotion-notify feature the same way a couple of the other fixes
-- this session accidentally broke real functionality. So this scopes
-- vendor-initiated inserts to "any vendor (who owns a stall) may
-- notify any consumer-role account" — broader than the two specific
-- real paths, but still meaningfully restricted (no notifying other
-- vendors/admins, no non-vendor account can do this at all), and
-- notifications are informational only, not a money/security-bearing
-- channel, so that tradeoff is deliberate rather than a shortcut.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: current state before touching anything.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'notifications';

select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename = 'notifications'
order by cmd;

alter table public.notifications enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where tablename = 'notifications'
  loop
    execute format('drop policy if exists %I on public.notifications', pol.policyname);
  end loop;
end $$;

create policy "Users can view own notifications"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Self, vendor-to-customer, or admin can insert"
  on public.notifications for insert
  with check (
    user_id = auth.uid()
    or public.is_admin()
    or (
      exists (select 1 from public.stalls s where s.vendor_id = auth.uid())
      and exists (select 1 from public.profiles p where p.id = notifications.user_id and p.role = 'consumer')
    )
  );

-- markAsRead/markAllAsRead only ever flip is_read — nothing else about
-- a notification (who it's for, its content) should be editable by
-- the recipient after the fact.
create policy "Users can mark own notifications read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (
    user_id = (select n.user_id from public.notifications n where n.id = notifications.id)
    and title = (select n.title from public.notifications n where n.id = notifications.id)
    and message = (select n.message from public.notifications n where n.id = notifications.id)
    and type is not distinct from (select n.type from public.notifications n where n.id = notifications.id)
  );

create policy "Admins can update any notification"
  on public.notifications for update
  using (public.is_admin());

create policy "Users can delete own notifications"
  on public.notifications for delete
  using (user_id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename = 'notifications'
order by cmd, policyname;
