-- =====================================================
-- Fix: "Failed to load tracked anomalies: Could not find a
-- relationship between 'price_anomalies' and 'vendor_id' in the
-- schema cache"
--
-- Root cause: create-price-anomalies-table.sql pointed vendor_id and
-- flagged_by at auth.users(id) (matching haggle_offers' own
-- convention). But PostgREST can only auto-detect an embeddable
-- relationship (the `vendor:vendor_id(full_name, email)` syntax the
-- admin dashboard's query uses) through a foreign key that lands
-- directly on the table you're trying to embed — here, that's
-- public.profiles, not auth.users. create-audit-log-table.sql
-- already uses the correct pattern (`references public.profiles(id)`)
-- for exactly this reason; price_anomalies just didn't match it.
--
-- This re-points both FKs at public.profiles(id) instead. No data
-- changes — profiles.id is always the same value as the matching
-- auth.users.id, so every existing row still satisfies the new FK.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: confirm the constraint names being replaced below
-- actually match what's really on the table.
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.price_anomalies'::regclass and contype = 'f';

alter table public.price_anomalies drop constraint if exists price_anomalies_vendor_id_fkey;
alter table public.price_anomalies
  add constraint price_anomalies_vendor_id_fkey
  foreign key (vendor_id) references public.profiles(id) on delete cascade;

alter table public.price_anomalies drop constraint if exists price_anomalies_flagged_by_fkey;
alter table public.price_anomalies
  add constraint price_anomalies_flagged_by_fkey
  foreign key (flagged_by) references public.profiles(id) on delete set null;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.price_anomalies'::regclass and contype = 'f';
