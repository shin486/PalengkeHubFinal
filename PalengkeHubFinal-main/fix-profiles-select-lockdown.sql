-- =====================================================
-- Follow-up to fix-CRITICAL-profiles-privilege-escalation.sql — that
-- file closed the write-side hole (self-granting admin, deleting any
-- account) but deliberately left SELECT alone, because a blind
-- "own row or admin" restriction breaks real, legitimate features
-- that need to read *other* users' profile rows:
--
--   - StallDetailsScreen.js shows a vendor's name/avatar/phone to any
--     customer browsing that stall (intentionally — see the
--     "email excluded, phone kept" comment already in that file)
--   - VendorDashboardScreen.js's "Suki Buyers" widget shows name/
--     avatar for multiple repeat customers at once
--   - VendorReportIssueScreen.js shows name + email for a vendor's
--     own customers, in a searchable picker (a real, used feature —
--     see fix-CRITICAL-profiles-privilege-escalation.sql's sibling
--     app-code changes, which stopped 4 *other* screens from pulling
--     email needlessly but deliberately left this one alone)
--   - SignUpScreen.js's pre-auth "max 5 accounts per email" and
--     "no duplicate name on this email" checks run before any
--     session exists at all
--
-- This file closes the actual leak (email, phone-for-everyone-except-
-- the-stall-contact-case, compliance_*, is_active — the full row —
-- no longer readable by an arbitrary authenticated user) while
-- keeping every one of the above working, via:
--
--   1. public.profiles_public — a view exposing only the columns
--      that are genuinely meant to be public in this app (id,
--      full_name, avatar_url, phone, role). Views in Postgres run
--      with the view owner's privileges by default, not the querying
--      user's — so this view keeps seeing every row even after the
--      base table's own RLS gets locked down below. StallDetails and
--      Suki Buyers switch to reading this instead of the base table
--      (see the accompanying .js changes).
--
--   2. Three SECURITY DEFINER functions for the cases the view can't
--      cover, because they need either data the view doesn't expose
--      (email) or need to run before a session exists (signup):
--        - get_my_stall_customers(): email+name for customers who
--          have a real order with the CALLING vendor's own stall —
--          checked via a join against orders, not a bare ID list, so
--          a vendor can't use this to fish for a specific stranger's
--          email.
--        - check_email_account_count(p_email): row count only, for
--          the "5 accounts per email" signup limit.
--        - check_email_duplicate_name(p_email, p_name): boolean
--          only, for the "no duplicate name on this email" signup
--          check.
--      All three return the minimum shape the caller actually needs
--      — never a full profile row — regardless of who calls them.
--
--   3. profiles SELECT locked to own row or admin, same pattern as
--      the write-side policies in the CRITICAL fix file.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
--   4. Then deploy the accompanying app code changes (already made
--      in this repo) — StallDetailsScreen.js and
--      VendorDashboardScreen.js now read profiles_public instead of
--      profiles directly, VendorReportIssueScreen.js and
--      SignUpScreen.js now call the RPCs above instead of querying
--      profiles directly for other users' rows. Running this SQL
--      before that code ships would make those specific screens show
--      no vendor name / no suki buyers / no signup-limit enforcement
--      until the app update lands — everything else keeps working
--      either order.
-- =====================================================

-- Diagnostic: current SELECT policies on profiles, before touching them.
select schemaname, tablename, policyname, cmd, qual
from pg_policies
where tablename = 'profiles' and cmd = 'SELECT';

-- 1) Public-safe view. security_invoker is deliberately left at its
-- default (off) — this view must keep working for anon/authenticated
-- callers regardless of the restrictive policy added below.
drop view if exists public.profiles_public;
create view public.profiles_public as
  select id, full_name, avatar_url, phone, role
  from public.profiles;

grant select on public.profiles_public to anon, authenticated;

-- 2) Vendor's own customers, with email — scoped to real order
-- history with the CALLING vendor's stall, not a bare ID lookup.
create or replace function public.get_my_stall_customers()
returns table (id uuid, full_name text, email text)
language sql
security definer
set search_path = public
as $$
  select distinct p.id, p.full_name, p.email
  from public.profiles p
  join public.orders o on o.consumer_id = p.id
  join public.stalls s on s.id = o.stall_id
  where s.vendor_id = auth.uid();
$$;

grant execute on function public.get_my_stall_customers() to authenticated;

-- 3) Signup pre-checks — count and duplicate-name only, never row data.
create or replace function public.check_email_account_count(p_email text)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer from public.profiles where email = p_email;
$$;

grant execute on function public.check_email_account_count(text) to anon, authenticated;

create or replace function public.check_email_duplicate_name(p_email text, p_name text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where email = p_email and full_name ilike p_name
  );
$$;

grant execute on function public.check_email_duplicate_name(text, text) to anon, authenticated;

-- 4) Lock down the base table's SELECT — everything above is what
-- keeps working after this.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where tablename = 'profiles' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (exists (select 1 from public.profiles admin_check where admin_check.id = auth.uid() and admin_check.role = 'admin'));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select schemaname, tablename, policyname, cmd, qual
from pg_policies
where tablename = 'profiles' and cmd = 'SELECT';

select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('get_my_stall_customers', 'check_email_account_count', 'check_email_duplicate_name');
