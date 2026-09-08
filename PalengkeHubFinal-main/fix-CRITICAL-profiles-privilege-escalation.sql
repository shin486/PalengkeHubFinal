-- =====================================================
-- CRITICAL SECURITY FIX — privilege escalation + data destruction
--
-- Live-confirmed during security testing (2026-09-08): any logged-in
-- customer can PATCH ANY OTHER user's public.profiles row, including
-- setting their own role to 'admin' — full takeover of the admin
-- dashboard with zero admin credentials. Reproduced and immediately
-- reverted:
--
--   PATCH /rest/v1/profiles?id=eq.<any-user> { "role": "admin" }
--   -> 200, role actually changed.
--
-- Also confirmed: DELETE against public.profiles is not blocked
-- either (any authenticated user can delete any other user's
-- account row), and vendor_applications is fully readable by any
-- authenticated user — including signed URLs to other applicants'
-- government ID photos and business permits.
--
-- Root cause (see add-admin-rls-policies.sql's own comment, written
-- earlier and never re-checked): whoever originally set up RLS for
-- "let admin see/edit everything" on profiles and vendor_applications
-- wrote the policy broad enough to match ANY authenticated user, not
-- just admins — most likely `using (true)` or `using (auth.uid() is
-- not null)` instead of actually checking role = 'admin'. This file
-- finds and removes every existing policy on the affected tables/
-- commands (names unknown — never surfaced in this repo), then
-- rebuilds them narrowly.
--
-- Scope of this file: WRITE access only (update/delete/insert) on
-- profiles and vendor_applications, all of which had no legitimate
-- reason to be open beyond "own row" or "admin". profiles SELECT is
-- NOT touched here — full_name/avatar_url on other users' rows are
-- read by many legitimate features across the app (a vendor's name
-- on a stall page, a customer's name on an order, chat participant
-- names, etc.), and locking SELECT down blind risks breaking all of
-- them. That needs a proper audit of every read site before fixing.
-- The immediate danger — anyone becoming admin, or deleting any
-- account — is closed by this file regardless.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: see every policy currently on these tables before
-- touching anything, so you can compare against what's listed at
-- the bottom after this runs.
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('profiles', 'vendor_applications')
order by tablename, cmd;

-- Drop every existing policy on the affected commands for both
-- tables — their real names were never surfaced anywhere in this
-- repo, so rather than guess, find and remove them all
-- programmatically. SELECT policies on profiles are deliberately
-- left alone (see note above).
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where tablename = 'profiles' and cmd in ('UPDATE', 'DELETE', 'INSERT')
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;

  for pol in
    select policyname from pg_policies
    where tablename = 'vendor_applications' and cmd in ('SELECT', 'UPDATE', 'DELETE', 'INSERT')
  loop
    execute format('drop policy if exists %I on public.vendor_applications', pol.policyname);
  end loop;
end $$;

-- profiles: a user may only update their OWN row, and only the
-- fields that are legitimately self-service (name, avatar, favorites,
-- phone) — role, is_active, and the compliance_* fields can never be
-- part of a user-initiated change, only an admin's. Comparing NEW
-- against the actual stored OLD row (not just trusting whatever the
-- client sends) is what actually closes the escalation path.
create policy "Users can update own profile (non-privileged fields)"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and is_active = (select p.is_active from public.profiles p where p.id = auth.uid())
    and compliance_score = (select p.compliance_score from public.profiles p where p.id = auth.uid())
    and compliance_warnings = (select p.compliance_warnings from public.profiles p where p.id = auth.uid())
  );

create policy "Admins can update any profile"
  on public.profiles for update
  using (exists (select 1 from public.profiles admin_check where admin_check.id = auth.uid() and admin_check.role = 'admin'));

-- No user-facing feature deletes a profiles row directly (account
-- deletion, if it exists at all, should go through an admin action
-- or a service-role backend flow) — so delete stays admin-only.
create policy "Admins can delete any profile"
  on public.profiles for delete
  using (exists (select 1 from public.profiles admin_check where admin_check.id = auth.uid() and admin_check.role = 'admin'));

-- Row creation happens via Supabase Auth's own trigger/signup flow
-- (service role), not a direct client insert — no policy needed here
-- for normal users; admins can still insert if ever needed.
create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (exists (select 1 from public.profiles admin_check where admin_check.id = auth.uid() and admin_check.role = 'admin'));

-- vendor_applications: contains applicants' government ID photos and
-- business permits (as signed URLs) — only the applicant themselves
-- and admins have any legitimate reason to see a given row.
create policy "Applicant can view own application"
  on public.vendor_applications for select
  using (auth.uid() = applicant_id);

create policy "Admins can view all vendor applications"
  on public.vendor_applications for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

-- Only admins decide approve/reject/notes on an application; the
-- applicant can still submit a resubmission (existing app flow) but
-- not silently flip their own status to 'approved'.
create policy "Admins can update vendor applications"
  on public.vendor_applications for update
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

create policy "Applicant can resubmit own application"
  on public.vendor_applications for update
  using (auth.uid() = applicant_id)
  with check (
    auth.uid() = applicant_id
    and status = (select va.status from public.vendor_applications va where va.id = id)
  );

-- A real signup writes its own application row (the applicant_id is
-- their own new account) — this is the one legitimate non-admin
-- insert path.
create policy "User can submit own vendor application"
  on public.vendor_applications for insert
  with check (auth.uid() = applicant_id);

create policy "Admins can delete vendor applications"
  on public.vendor_applications for delete
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where tablename in ('profiles', 'vendor_applications')
order by tablename, cmd;
