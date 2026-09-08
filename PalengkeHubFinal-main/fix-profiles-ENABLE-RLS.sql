-- =====================================================
-- Three straight attempts at fixing profiles' policies (this file's
-- two predecessors, both live-confirmed to have failed) all assumed
-- one thing I never actually checked: that Row Level Security is
-- turned ON for this table at all. Creating a policy does NOT enable
-- RLS by itself — a table can have any number of policies sitting in
-- pg_policies and every one of them stays completely inert if
-- `ENABLE ROW LEVEL SECURITY` was never run on the table itself. If
-- that's the actual situation here, it would explain all three
-- failures at once, regardless of how correct the policies
-- themselves were — Postgres simply never evaluates policies on a
-- table where RLS is off.
--
-- Every other table fixed this session (haggle_offers, etc.) had its
-- RLS explicitly enabled in the same script that added its policies.
-- None of the three profiles attempts did, because existing policies
-- in pg_policies looked like proof RLS was already on — but a policy
-- can exist and be entirely dormant at the same time.
--
-- This checks that directly first, and turns it on (plus FORCE, so
-- even the table owner doesn't get a free pass) if it's off.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
--   4. Tell me exactly what the first query returns — specifically
--      whether rls_enabled was true or false BEFORE this ran.
-- =====================================================

-- Diagnostic: the actual, direct answer — is RLS on for this table?
select relname, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where relname = 'profiles' and relnamespace = 'public'::regnamespace;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select relname, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where relname = 'profiles' and relnamespace = 'public'::regnamespace;
