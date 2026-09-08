-- =====================================================
-- Supersedes fix-CRITICAL-profiles-privilege-escalation.sql and the
-- policy-locking part of fix-profiles-select-lockdown.sql (the view
-- and the 3 RPC functions from that second file are unaffected by
-- this and don't need re-running — this only touches policies).
--
-- Both of those were run and DIDN'T WORK — live-confirmed after
-- running them: a plain customer could still grant themselves admin,
-- still delete another user's account row entirely (confirmed live —
-- had to restore a real deleted row from a backup of its own data),
-- and still read every user's email straight from the base table.
--
-- Diagnosed root cause: my drop loops in both files filtered
-- pg_policies by exact cmd values — 'SELECT', or 'UPDATE'/'DELETE'/
-- 'INSERT'. If the original wide-open policy on profiles was created
-- as `FOR ALL` (one policy covering every command at once — a common
-- quick first-pass way to set up RLS), Postgres reports its cmd as
-- the literal string 'ALL', which neither loop's filter would ever
-- match. So the old permissive policy was never actually dropped —
-- my new restrictive ones just got added next to it, and Postgres
-- OR-combines multiple permissive policies for the same command, so
-- the old permissive one kept winning regardless of what got added
-- alongside it. This file drops every policy on the table
-- unconditionally, whatever its cmd, then rebuilds the complete set
-- from scratch in one place.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
--   4. Check the two verify queries at the bottom actually show 4
--      rows (one each for select/update/delete/insert) and 0 rows
--      left over with any other name — if anything unexpected is
--      still listed, tell me exactly what it says before trusting
--      this is closed this time.
-- =====================================================

-- Diagnostic: every policy currently on profiles, all commands —
-- this is what should explain the "FOR ALL" theory above.
select schemaname, tablename, policyname, cmd, permissive, qual, with_check
from pg_policies
where tablename = 'profiles'
order by cmd;

-- Drop every single existing policy on profiles, regardless of which
-- command(s) it covers. No filter this time.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

-- SELECT: own row, or admin.
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (select 1 from public.profiles a where a.id = auth.uid() and a.role = 'admin')
  );

-- UPDATE: own row (but role/is_active/compliance_* can't be changed by
-- the row owner — only by an admin), or admin can update any row.
create policy "profiles_update_own_nonprivileged"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
    and compliance_score = (select p.compliance_score from public.profiles p where p.id = auth.uid())
    and compliance_warnings = (select p.compliance_warnings from public.profiles p where p.id = auth.uid())
  );

create policy "profiles_update_admin"
  on public.profiles for update
  using (exists (select 1 from public.profiles a where a.id = auth.uid() and a.role = 'admin'));

-- DELETE / INSERT: admin only — no legitimate app feature does either
-- of these as a plain user (signup creates the row via Supabase
-- Auth's own service-role flow, not a client insert).
create policy "profiles_delete_admin"
  on public.profiles for delete
  using (exists (select 1 from public.profiles a where a.id = auth.uid() and a.role = 'admin'));

create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (exists (select 1 from public.profiles a where a.id = auth.uid() and a.role = 'admin'));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
-- Expect exactly 5 rows: profiles_select_own_or_admin,
-- profiles_update_own_nonprivileged, profiles_update_admin,
-- profiles_delete_admin, profiles_insert_admin. Nothing else.
select schemaname, tablename, policyname, cmd, permissive
from pg_policies
where tablename = 'profiles'
order by cmd, policyname;

-- Sanity count — should also be exactly 5.
select count(*) as total_policies_on_profiles
from pg_policies
where tablename = 'profiles';
