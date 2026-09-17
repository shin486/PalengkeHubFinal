-- =====================================================
-- The fix in fix-profiles-self-update-rls.sql was applied, but a
-- direct test upsert against public.profiles still returns the exact
-- same 403 "new row violates row-level security policy" -- meaning
-- either the new policy isn't actually there, or something else on
-- the table is still blocking it (a RESTRICTIVE policy, RLS forced
-- even for owners, etc).
--
-- Run this and paste back the full result -- it will show exactly
-- what's on the table right now, which settles it either way instead
-- of guessing again.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

-- 1. Every policy currently on profiles, permissive or restrictive,
--    for every command. If "Users can update own profile" isn't in
--    this list, the create-policy statement never actually landed.
select
  policyname,
  cmd,
  permissive,
  roles,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by cmd, policyname;

-- 2. Is RLS even enabled, and is it FORCED (which would block even the
--    table owner unless they're a superuser)?
select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where oid = 'public.profiles'::regclass;

-- 3. Does the enforce_profile_self_update_rules trigger from the fix
--    actually exist and is it enabled?
select tgname, tgenabled
from pg_trigger
where tgrelid = 'public.profiles'::regclass and tgname = 'trg_enforce_profile_self_update_rules';
