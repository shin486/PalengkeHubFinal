-- =====================================================
-- Regression check: fix-profiles-select-lockdown.sql (written after
-- fix-profiles-RECURSION.sql) replaced profiles' SELECT policies with:
--
--   create policy "Admins can view all profiles" on public.profiles
--     for select using (exists (
--       select 1 from public.profiles admin_check
--       where admin_check.id = auth.uid() and admin_check.role = 'admin'
--     ));
--
-- That is the EXACT bug fix-profiles-RECURSION.sql already fixed once
-- ("the entire app is down right now... every query against profiles
-- fails with 42P17 infinite recursion") — a profiles policy that
-- queries profiles again from within itself. If this ever gets
-- (re)applied without also re-running the recursion fix afterward,
-- every read of your own profile — including the one login() and
-- checkUser() do right after signing in — starts failing, and (per
-- App.js's RootNavigator) a signed-in user with no profile loaded
-- falls back to the Login route. That matches "I sign in and land
-- back on the Login page" exactly.
--
-- This is a defensive re-apply, not a guess about current state: it's
-- safe and a no-op if profiles_select_own_or_admin (is_admin()-based)
-- is already what's live. Run the diagnostic block first if you want
-- to see which one is actually active before fixing.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: if you see a policy here whose qual contains a second
-- "from public.profiles" / "from profiles admin_check", that's the
-- recursive one — this file removes it either way.
select policyname, cmd, qual
from pg_policies
where tablename = 'profiles' and cmd = 'SELECT';

-- is_admin() already exists from fix-profiles-RECURSION.sql — recreate
-- defensively in case this file ever runs standalone on a fresh DB.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select policyname, cmd, qual
from pg_policies
where tablename = 'profiles' and cmd = 'SELECT';
