-- =====================================================
-- Fix: the admin dashboard's "Chats" panel can read (and post
-- into) ANY customer's private conversation with a vendor.
--
-- Root cause: there has never been a separate admin<->vendor
-- channel. Admin's Chat panel queries the exact same
-- `conversations`/`messages` tables customer<->vendor chat uses,
-- and add-admin-rls-policies.sql (already applied) gave admin a
-- blanket SELECT policy on both tables — "the admin Messages
-- screen monitors every conversation" — which was a reasonable
-- fix for "admin dashboard shows no data" at the time, but means
-- admin can currently open literally any customer's chat with a
-- vendor. That's the confidentiality leak being fixed here.
--
-- This migration:
--   1. Adds a `conversation_type` column ('customer_vendor' |
--      'admin_vendor') so the two kinds of conversation can
--      finally be told apart. Every existing row defaults to
--      'customer_vendor', so nothing already in the table changes
--      meaning.
--   2. Makes `customer_id` nullable (an admin_vendor row has no
--      customer).
--   3. Replaces the two blanket "Admins can view all
--      messages/conversations" policies with versions scoped to
--      conversation_type = 'admin_vendor' only — admin can no
--      longer see customer_vendor rows at the database level, not
--      just in the app UI.
--   4. Adds matching INSERT/UPDATE policies (both directions) so
--      the new admin<->vendor channel actually works, plus a SELECT
--      for vendors on their own admin_vendor row.
--
-- Existing customer_vendor access (both apps) is untouched — every
-- policy here is either brand new or scoped strictly to the new
-- conversation_type, so this cannot remove access that already works.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
--
-- Optional, before running the rest of this file: if you want to
-- see exactly what INSERT/UPDATE policies already exist on these
-- two tables (some were created directly in Supabase Studio and
-- aren't in any checked-in migration), run this first and share
-- the result:
--
--   select schemaname, tablename, policyname, cmd, qual, with_check
--   from pg_policies
--   where tablename in ('conversations', 'messages')
--   order by tablename, cmd;
-- =====================================================

-- ── 1. conversation_type column ──────────────────────────────
alter table public.conversations
  add column if not exists conversation_type text not null default 'customer_vendor'
  check (conversation_type in ('customer_vendor', 'admin_vendor'));

-- ── 2. customer_id becomes optional (admin_vendor rows have none) ──
alter table public.conversations
  alter column customer_id drop not null;

-- ── 3. One admin<->vendor conversation per stall ─────────────
create unique index if not exists conversations_admin_vendor_stall_uidx
  on public.conversations (stall_id)
  where conversation_type = 'admin_vendor';

-- ── 4. Replace the blanket admin SELECT policies ─────────────
drop policy if exists "Admins can view all messages" on public.messages;
create policy "Admins can view admin_vendor messages" on public.messages
  for select
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.conversation_type = 'admin_vendor'
    )
  );

drop policy if exists "Admins can view all conversations" on public.conversations;
create policy "Admins can view admin_vendor conversations" on public.conversations
  for select
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
    and conversation_type = 'admin_vendor'
  );

-- ── 5. Vendor access to their own admin_vendor conversation ──
drop policy if exists "Vendors can view own admin_vendor conversation" on public.conversations;
create policy "Vendors can view own admin_vendor conversation" on public.conversations
  for select
  using (
    conversation_type = 'admin_vendor'
    and exists (select 1 from public.stalls s where s.id = conversations.stall_id and s.vendor_id = auth.uid())
  );

drop policy if exists "Vendors can view own admin_vendor messages" on public.messages;
create policy "Vendors can view own admin_vendor messages" on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations c
      join public.stalls s on s.id = c.stall_id
      where c.id = messages.conversation_id
        and c.conversation_type = 'admin_vendor'
        and s.vendor_id = auth.uid()
    )
  );

-- ── 6. INSERT policies (both directions need to be able to
--       start/continue the thread) ───────────────────────────
drop policy if exists "Vendors can insert own admin_vendor conversation" on public.conversations;
create policy "Vendors can insert own admin_vendor conversation" on public.conversations
  for insert
  with check (
    conversation_type = 'admin_vendor'
    and exists (select 1 from public.stalls s where s.id = conversations.stall_id and s.vendor_id = auth.uid())
  );

drop policy if exists "Admins can insert admin_vendor conversation" on public.conversations;
create policy "Admins can insert admin_vendor conversation" on public.conversations
  for insert
  with check (
    conversation_type = 'admin_vendor'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Vendors can insert own admin_vendor messages" on public.messages;
create policy "Vendors can insert own admin_vendor messages" on public.messages
  for insert
  with check (
    exists (
      select 1 from public.conversations c
      join public.stalls s on s.id = c.stall_id
      where c.id = messages.conversation_id
        and c.conversation_type = 'admin_vendor'
        and s.vendor_id = auth.uid()
    )
  );

drop policy if exists "Admins can insert admin_vendor messages" on public.messages;
create policy "Admins can insert admin_vendor messages" on public.messages
  for insert
  with check (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.conversation_type = 'admin_vendor'
    )
  );

-- ── 7. UPDATE policies (last_message/unread bumps, mark-as-read) ──
drop policy if exists "Vendors can update own admin_vendor conversation" on public.conversations;
create policy "Vendors can update own admin_vendor conversation" on public.conversations
  for update
  using (
    conversation_type = 'admin_vendor'
    and exists (select 1 from public.stalls s where s.id = conversations.stall_id and s.vendor_id = auth.uid())
  );

drop policy if exists "Admins can update admin_vendor conversation" on public.conversations;
create policy "Admins can update admin_vendor conversation" on public.conversations
  for update
  using (
    conversation_type = 'admin_vendor'
    and exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
  );

drop policy if exists "Vendors can update own admin_vendor messages" on public.messages;
create policy "Vendors can update own admin_vendor messages" on public.messages
  for update
  using (
    exists (
      select 1 from public.conversations c
      join public.stalls s on s.id = c.stall_id
      where c.id = messages.conversation_id
        and c.conversation_type = 'admin_vendor'
        and s.vendor_id = auth.uid()
    )
  );

drop policy if exists "Admins can update admin_vendor messages" on public.messages;
create policy "Admins can update admin_vendor messages" on public.messages
  for update
  using (
    exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin')
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id and c.conversation_type = 'admin_vendor'
    )
  );

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'conversations'
order by ordinal_position;

select schemaname, tablename, policyname, cmd
from pg_policies
where tablename in ('conversations', 'messages')
order by tablename, cmd, policyname;
