-- =====================================================
-- Fix: "Deactivate" on the admin User Management screen does
-- nothing — the profiles table has no is_active column at all.
--
-- Root cause: web/src/pages/AdminDashboard.jsx's UserManagement
-- component reads/writes profiles.is_active (status badge, the
-- toggleActive() button), but this column was never added to the
-- database. Every deactivate/activate click sends a real UPDATE
-- request that Postgres rejects with:
--   42703 column profiles.is_active does not exist
-- The admin UI doesn't check the update's error result, so it
-- shows "User deactivated successfully" regardless — the toast
-- lied, nothing ever changed.
--
-- (This is unrelated to stalls.is_active, which already exists
-- and already works correctly — only profiles was missing it.)
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

alter table public.profiles
  add column if not exists is_active boolean not null default true;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
  and column_name = 'is_active';
