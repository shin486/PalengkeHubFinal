-- =====================================================
-- complaints + customer_reports: same "no tracked policy definitions,
-- app trusts RLS entirely" situation as the other tables fixed this
-- session. Both are simple self-report tables (a customer files
-- against their own user_id — OrdersScreen.js's "Report Issue" writes
-- to complaints, ReportIssueScreen.js's report flow writes to
-- customer_reports), with admin resolving complaints via
-- AdminDashboard.jsx (no admin UI for customer_reports exists yet,
-- but the same protection is added for consistency/when one is built).
--
-- Nothing in the app updates either table's own status/resolution
-- fields from the reporting user's side — only admin does that (for
-- complaints). Without RLS enforcing that server-side, a user could
-- currently PATCH their own complaint straight to status: 'resolved'
-- and skip admin review entirely, the same self-service bypass already
-- found and fixed on price_anomalies this session — or read/file
-- reports as a different user_id outright.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: current state before touching anything.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('complaints', 'customer_reports');

select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename in ('complaints', 'customer_reports')
order by tablename, cmd;

alter table public.complaints enable row level security;
alter table public.customer_reports enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where tablename = 'complaints'
  loop
    execute format('drop policy if exists %I on public.complaints', pol.policyname);
  end loop;

  for pol in
    select policyname from pg_policies where tablename = 'customer_reports'
  loop
    execute format('drop policy if exists %I on public.customer_reports', pol.policyname);
  end loop;
end $$;

-- ── complaints ───────────────────────────────────────────

create policy "Users can view own complaints"
  on public.complaints for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Users can file own complaint"
  on public.complaints for insert
  with check (user_id = auth.uid());

create policy "Admins can resolve complaints"
  on public.complaints for update
  using (public.is_admin());

create policy "Admins can delete complaints"
  on public.complaints for delete
  using (public.is_admin());

-- ── customer_reports ─────────────────────────────────────

create policy "Users can view own reports"
  on public.customer_reports for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Users can file own report"
  on public.customer_reports for insert
  with check (user_id = auth.uid());

create policy "Admins can resolve reports"
  on public.customer_reports for update
  using (public.is_admin());

create policy "Admins can delete reports"
  on public.customer_reports for delete
  using (public.is_admin());

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename in ('complaints', 'customer_reports')
order by tablename, cmd, policyname;
