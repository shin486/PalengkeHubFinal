-- =====================================================
-- Fix: the admin dashboard shows "no data" across most of its
-- sections (Orders/"Transaction Records", Reports & Audit, Stall
-- Transactions, Complaints, Price History/Anomalies, Messages),
-- even though the underlying data genuinely exists.
--
-- Root cause: Row Level Security on these tables was written for
-- "a customer can see their own row" / "a vendor can see their own
-- stall's rows" — nobody ever added a policy letting an admin see
-- ACROSS all rows. So every admin-dashboard query against these
-- tables silently returns zero rows (not an error — RLS just
-- filters everything out), which looks exactly like "there's no
-- data" even though e.g. `orders` has real rows in it.
--
-- Confirmed by direct probe: a real customer could see their own
-- order; the same order was completely invisible to an admin
-- session querying the identical row.
--
-- Tables that ALREADY correctly let admin see everything (no
-- change needed): profiles, stalls, products, vendor_applications,
-- announcements.
--
-- Tables that were silently blocking admin (fixed below): orders,
-- complaints, price_history, messages, conversations, notifications.
--
-- (order_items was in an earlier version of this file and has been
-- removed — this app stores order line items as a JSONB `items`
-- column directly on `orders`, there is no separate order_items
-- table. Running the old version errored on that with 42P01, and
-- because the SQL Editor runs the whole paste as one transaction,
-- that single error rolled back every policy in the file — so if
-- you ran the old version, NONE of this took effect. Run this
-- version instead.)
--
-- These are purely ADDITIVE policies — Postgres OR-combines multiple
-- permissive RLS policies for the same command, so this only adds
-- visibility for admins. It cannot remove or break any access that
-- already works for customers/vendors. Each one drops-if-exists
-- first, so this file is safe to re-run.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- orders: admin needs to both view (Orders page, Reports, Stall
-- "Transactions", user/vendor detail KPIs) and update (status
-- changes, moderation) every order, not just their own.
drop policy if exists "Admins can view all orders" on public.orders;
create policy "Admins can view all orders" on public.orders
  for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can update all orders" on public.orders;
create policy "Admins can update all orders" on public.orders
  for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- complaints: the admin Complaints screen needs to see and resolve
-- every complaint, not just ones filed by/about the admin account.
drop policy if exists "Admins can view all complaints" on public.complaints;
create policy "Admins can view all complaints" on public.complaints
  for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can update all complaints" on public.complaints;
create policy "Admins can update all complaints" on public.complaints
  for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- price_history: feeds Price History / Price Anomalies.
drop policy if exists "Admins can view all price_history" on public.price_history;
create policy "Admins can view all price_history" on public.price_history
  for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- messages + conversations: the admin Messages screen monitors/
-- moderates every conversation, not just ones the admin is a party to.
drop policy if exists "Admins can view all messages" on public.messages;
create policy "Admins can view all messages" on public.messages
  for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

drop policy if exists "Admins can view all conversations" on public.conversations;
create policy "Admins can view all conversations" on public.conversations
  for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- notifications: surfaced in admin activity/insights views.
drop policy if exists "Admins can view all notifications" on public.notifications;
create policy "Admins can view all notifications" on public.notifications
  for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select schemaname, tablename, policyname, cmd
from pg_policies
where policyname like 'Admins can%'
order by tablename, cmd;
