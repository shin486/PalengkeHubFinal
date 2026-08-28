-- =====================================================
-- Fix: the admin dashboard's audit trail has never worked — the
-- `audit_log` table it reads and writes doesn't exist in the
-- database at all.
--
-- Every admin action that's supposed to leave a trail (deactivating
-- a user/stall, approving/rejecting a vendor application, updating
-- stall details, approving a stall location, resolving a complaint,
-- posting an announcement, etc.) calls logAudit(), which does
-- `supabase.from('audit_log').insert(...)`. That request has always
-- 404'd (PGRST205: table not found in schema cache) — silently,
-- because logAudit() wraps it in its own try/catch so the admin
-- action itself still succeeds. Net effect: every admin action really
-- does happen, but nothing has ever actually been logged, and the
-- "Audit Logs" sub-tab under Reports & Audit has always been empty
-- because its SELECT against the same missing table also 404s.
--
-- Schema matches exactly what web/src/pages/AdminDashboard.jsx reads
-- and writes: action, table_name, record_id, details, user_id,
-- created_at, plus a FK to profiles for the "user:profiles(full_name)"
-- join the Audit Logs table does.
--
-- record_id is text, not uuid/bigint — the code logs record ids from
-- several tables with different id types (uuid for vendor_applications,
-- bigint for stalls, even an email string for profiles in one place),
-- so a single flexible column is simplest and matches how it's used.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  table_name text,
  record_id text,
  details text,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Any authenticated user can write an audit entry — every existing
-- call site is already admin-only in practice (gated by the admin
-- dashboard's own login check), and an audit table only needs to
-- resist tampering (no UPDATE/DELETE policy below), not resist writes.
create policy "Authenticated users can insert audit_log" on public.audit_log
  for insert
  with check (auth.uid() is not null);

-- Only admins can read the trail.
create policy "Admins can view audit_log" on public.audit_log
  for select
  using (exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.role = 'admin'));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'audit_log'
order by ordinal_position;
