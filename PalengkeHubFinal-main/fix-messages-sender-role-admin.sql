-- =====================================================
-- Fix: Admin↔vendor chat can't send — "new row for relation
-- 'messages' violates check constraint 'messages_sender_role_check'"
--
-- Root cause: messages.sender_role has a CHECK constraint that was set
-- up back when chat only had two parties — 'customer' and 'vendor'
-- (still the only values written by OrdersScreen.js and
-- VendorOrdersScreen.js). When admin↔vendor chat was built
-- (AdminDashboard.jsx sends sender_role: 'admin'), the constraint was
-- never widened to allow it — every admin message has been rejected by
-- the database ever since, which is why chat "isn't connecting": the
-- request never actually fails to reach the server, it reaches it and
-- gets rejected.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: confirm the constraint being replaced actually matches
-- what's really on the table before touching it.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.messages'::regclass and contype = 'c' and conname = 'messages_sender_role_check';

alter table public.messages drop constraint if exists messages_sender_role_check;
alter table public.messages
  add constraint messages_sender_role_check
  check (sender_role in ('customer', 'vendor', 'admin'));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.messages'::regclass and contype = 'c' and conname = 'messages_sender_role_check';
