-- =====================================================
-- Pre-deployment routine check finding: public.violations had RLS
-- disabled entirely -- the only table in the schema in that state
-- (every other table has RLS on; several force it). With RLS off,
-- PostgREST falls back to plain role GRANTs, meaning any authenticated
-- (and possibly anonymous) caller with the app's public anon key could
-- read, insert, update, or delete rows for ANY vendor via a direct
-- REST call, regardless of app code -- app code never restricted
-- access on its own, it fully depended on RLS like every other table
-- in this schema.
--
-- Currently 0 rows and no app code in this repo references the table,
-- so this is a zero-risk lockdown: it can't break any existing flow,
-- it just closes the gap before something starts writing to it.
-- Modeled on vendor_applications' shape (admin issues/manages,
-- affected vendor can view their own).
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

alter table public.violations enable row level security;
alter table public.violations force row level security;

create policy "violations_select_own_or_admin"
  on public.violations for select
  using (auth.uid() = vendor_id or public.is_admin());

create policy "violations_insert_admin"
  on public.violations for insert
  with check (public.is_admin());

create policy "violations_update_admin"
  on public.violations for update
  using (public.is_admin());

create policy "violations_delete_admin"
  on public.violations for delete
  using (public.is_admin());

notify pgrst, 'reload schema';
