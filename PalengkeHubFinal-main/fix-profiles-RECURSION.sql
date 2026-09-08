-- =====================================================
-- URGENT — the entire app is down right now. Every query against
-- profiles fails with 42P17 "infinite recursion detected in policy
-- for relation profiles", which cascades into home screen,
-- notifications, orders, announcements, everything that touches a
-- user's own profile row (which is nearly the whole app).
--
-- Root cause: fix-profiles-policies-FINAL.sql's policies check "is
-- the caller an admin" with a subquery that reads from profiles —
-- from within a policy defined ON profiles. Evaluating "can I select
-- this row" requires running the admin-check, which itself requires
-- selecting from profiles, which re-triggers the same policy,
-- forever. This exact self-referencing pattern is used successfully
-- elsewhere in this repo (add-admin-rls-policies.sql, on orders/
-- complaints/etc.) without any problem, because those check profiles
-- FROM A DIFFERENT TABLE's policy — only checking a table from its
-- own policy recurses. That's also why this bug never surfaced in
-- the three earlier profiles attempts: RLS was actually off the
-- whole time (confirmed by fix-profiles-ENABLE-RLS.sql), so none of
-- those policies — including this same recursive pattern — was ever
-- actually evaluated until just now.
--
-- The standard fix: move the admin check into a SECURITY DEFINER
-- function. A SECURITY DEFINER function's internal queries run with
-- the function OWNER's privileges, not RLS-restricted like the
-- calling query — so checking admin status inside it doesn't
-- re-trigger the policy that's calling it, breaking the cycle.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
--   4. Test immediately after — the app should load again right away.
-- =====================================================

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

-- Same recursion risk applies to the UPDATE policy's WITH CHECK below
-- — comparing NEW.role against a plain subquery on profiles would hit
-- the identical self-reference cycle during an UPDATE. This wraps the
-- caller's own CURRENT (pre-update) privileged fields the same way,
-- via SECURITY DEFINER, so reading them for comparison doesn't
-- re-trigger the policy that's using them.
create or replace function public.get_my_privileged_fields()
returns table (role text, is_active boolean, compliance_score integer, compliance_warnings integer)
language sql
security definer
stable
set search_path = public
as $$
  select role, is_active, compliance_score, compliance_warnings
  from public.profiles where id = auth.uid();
$$;

grant execute on function public.get_my_privileged_fields() to authenticated;

-- Drop and rebuild every profiles policy using is_admin() instead of
-- an inline self-referencing subquery.
do $$
declare
  pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'profiles'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_update_own_nonprivileged"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and (role, is_active, compliance_score, compliance_warnings)
      = (select f.role, f.is_active, f.compliance_score, f.compliance_warnings
         from public.get_my_privileged_fields() f)
  );

create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin());

create policy "profiles_delete_admin"
  on public.profiles for delete
  using (public.is_admin());

create policy "profiles_insert_admin"
  on public.profiles for insert
  with check (public.is_admin());

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select schemaname, tablename, policyname, cmd, permissive
from pg_policies
where tablename = 'profiles'
order by cmd, policyname;

select count(*) as total_policies_on_profiles
from pg_policies
where tablename = 'profiles';
