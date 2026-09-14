-- =====================================================
-- Pre-deployment routine check finding: audit_log's INSERT policy was
-- `with check (auth.uid() is not null)` -- any authenticated customer
-- or vendor could insert a row with an arbitrary `user_id`, `action`,
-- `table_name`, `record_id`, and `details`, forging entries in what's
-- meant to be an admin forensic trail (SELECT is already admin-only).
-- create-audit-log-table.sql's own comment justified this as "every
-- call site is admin-only in practice" -- a UI-only gate, not one RLS
-- itself enforced, and the table is reachable directly via the REST
-- API with the public anon key plus any session token.
--
-- This repo currently has no code that writes to audit_log at all (the
-- web admin dashboard that originally did was removed in a later
-- commit), so tightening this can't break anything live -- it just
-- closes the gap in case a future admin surface starts writing to it.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

drop policy if exists "Authenticated users can insert audit_log" on public.audit_log;

create policy "Admins can insert audit_log"
  on public.audit_log for insert
  with check (public.is_admin() and user_id = auth.uid());

notify pgrst, 'reload schema';
