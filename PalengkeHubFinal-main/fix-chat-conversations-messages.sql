-- =====================================================
-- conversations + messages had no policy definitions in any tracked
-- SQL file in this repo — they were set up directly in Supabase
-- Studio at some point, so their current state is unknown from here.
--
-- That matters because chatService.js (the ONLY thing standing
-- between a client and these tables) does zero participant filtering
-- of its own — every read/write trusts RLS completely:
--   - getMessages(conversationId): `select * where conversation_id = X`,
--     no check that the caller is actually in that conversation.
--   - sendMessage(): inserts sender_id from a plain function argument,
--     not verified against the authenticated session.
--   - AdminDashboard.jsx's admin_vendor chat inserts sender_role:
--     'admin' directly, same lack of server-side participant check.
-- If the current RLS on these two tables has the same kind of gap
-- already found and fixed this session on profiles, vendor_applications,
-- ratings, and price_anomalies (a policy broad enough to match any
-- authenticated user, not just real participants), then any customer
-- or vendor account can read or post into ANY conversation on the
-- platform just by knowing/guessing a conversation_id — including
-- other people's private chats and the admin<->vendor support channel.
--
-- This rebuilds both tables' policies from scratch (drop everything
-- unconditionally first, in case an old permissive policy is still
-- sitting there — RLS policies are OR'd together, so a narrow new
-- policy added ALONGSIDE an old "using (true)" one would do nothing),
-- so the result is correct regardless of what's currently in place.
--
-- Access model, derived from actual usage in chatService.js and
-- AdminDashboard.jsx:
--   - A "customer_vendor" conversation (conversation_type is null):
--     visible/writable by that customer, the stall's own vendor, or
--     admin.
--   - An "admin_vendor" conversation: visible/writable by the stall's
--     own vendor, or admin. Both sides can create one (vendors message
--     admin from VendorChatListScreen/VendorSuspendedScreen; admin
--     starts them from AdminDashboard).
--   - messages inherits access from its parent conversation, plus:
--     sender_id on insert must be the caller's own uid (no posting as
--     someone else), and once written, only is_read may ever change
--     (marking read shouldn't be able to edit message content).
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: current state before touching anything.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('conversations', 'messages');

select tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('conversations', 'messages')
order by tablename, cmd;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Drop every existing policy on both tables, whatever it's named.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where tablename = 'conversations'
  loop
    execute format('drop policy if exists %I on public.conversations', pol.policyname);
  end loop;

  for pol in
    select policyname from pg_policies where tablename = 'messages'
  loop
    execute format('drop policy if exists %I on public.messages', pol.policyname);
  end loop;
end $$;

-- ── conversations ────────────────────────────────────────

create policy "Participants can view own conversation"
  on public.conversations for select
  using (
    customer_id = auth.uid()
    or exists (select 1 from public.stalls s where s.id = conversations.stall_id and s.vendor_id = auth.uid())
    or public.is_admin()
  );

create policy "Customer can start own conversation"
  on public.conversations for insert
  with check (
    conversation_type is distinct from 'admin_vendor'
    and customer_id = auth.uid()
  );

create policy "Vendor or admin can start admin_vendor conversation"
  on public.conversations for insert
  with check (
    conversation_type = 'admin_vendor'
    and (
      public.is_admin()
      or exists (select 1 from public.stalls s where s.id = conversations.stall_id and s.vendor_id = auth.uid())
    )
  );

-- Participants update chat metadata (last_message, unread counts, etc.)
-- on every send/read — but the identity of the conversation itself
-- (who it's between, which stall, what type) can't change underneath it.
create policy "Participants can update own conversation metadata"
  on public.conversations for update
  using (
    customer_id = auth.uid()
    or exists (select 1 from public.stalls s where s.id = conversations.stall_id and s.vendor_id = auth.uid())
  )
  with check (
    customer_id is not distinct from (select c.customer_id from public.conversations c where c.id = conversations.id)
    and stall_id = (select c.stall_id from public.conversations c where c.id = conversations.id)
    and conversation_type is not distinct from (select c.conversation_type from public.conversations c where c.id = conversations.id)
  );

create policy "Admins can update any conversation"
  on public.conversations for update
  using (public.is_admin());

create policy "Admins can delete conversations"
  on public.conversations for delete
  using (public.is_admin());

-- ── messages ─────────────────────────────────────────────

create policy "Participants can view conversation messages"
  on public.messages for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.customer_id = auth.uid()
          or exists (select 1 from public.stalls s where s.id = c.stall_id and s.vendor_id = auth.uid())
        )
    )
  );

-- Posting as anyone but yourself, or into a conversation you're not
-- part of, is blocked here — chatService.js takes sender_id as a plain
-- argument with no server-side check of its own, so this is the only
-- thing actually enforcing it.
create policy "Participants can send into own conversation"
  on public.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          public.is_admin()
          or c.customer_id = auth.uid()
          or exists (select 1 from public.stalls s where s.id = c.stall_id and s.vendor_id = auth.uid())
        )
    )
  );

-- markAsRead() only ever flips is_read — everything else about a
-- message (who sent it, its content, whether it's an image) is
-- immutable once written, participant or not.
create policy "Participants can mark messages read"
  on public.messages for update
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.customer_id = auth.uid()
          or exists (select 1 from public.stalls s where s.id = c.stall_id and s.vendor_id = auth.uid())
        )
    )
  )
  with check (
    conversation_id = (select m.conversation_id from public.messages m where m.id = messages.id)
    and sender_id is not distinct from (select m.sender_id from public.messages m where m.id = messages.id)
    and sender_role = (select m.sender_role from public.messages m where m.id = messages.id)
    and message is not distinct from (select m.message from public.messages m where m.id = messages.id)
    and image_url is not distinct from (select m.image_url from public.messages m where m.id = messages.id)
    and is_image is not distinct from (select m.is_image from public.messages m where m.id = messages.id)
  );

create policy "Admins can update any message"
  on public.messages for update
  using (public.is_admin());

create policy "Admins can delete messages"
  on public.messages for delete
  using (public.is_admin());

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('conversations', 'messages')
order by tablename, cmd, policyname;
