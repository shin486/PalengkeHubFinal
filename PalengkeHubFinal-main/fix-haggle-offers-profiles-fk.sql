-- =====================================================
-- Fix: Vendor "Offers" screen always shows "No offers yet" even when
-- real haggle offers exist — the underlying query silently 400s
-- ("Could not find a relationship between 'haggle_offers' and
-- 'profiles' in the schema cache") and the empty-state UI masks the
-- failure completely, so nothing ever visibly breaks.
--
-- Root cause: add-haggle-offers-table.sql pointed customer_id and
-- vendor_id at auth.users(id). PostgREST can only auto-detect an
-- embeddable relationship (the `customer:customer_id(full_name)` /
-- `vendor:vendor_id(...)` syntax VendorOffersScreen's query uses)
-- through a foreign key that lands directly on the table being
-- embedded — here, that's public.profiles, not auth.users.
-- price_anomalies had this exact same bug (see
-- fix-price-anomalies-vendor-fk.sql) — its own comment notes it copied
-- haggle_offers' convention, which turns out to be where the bug
-- actually originated.
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
where conrelid = 'public.haggle_offers'::regclass and contype = 'f';

alter table public.haggle_offers drop constraint if exists haggle_offers_customer_id_fkey;
alter table public.haggle_offers
  add constraint haggle_offers_customer_id_fkey
  foreign key (customer_id) references public.profiles(id) on delete cascade;

alter table public.haggle_offers drop constraint if exists haggle_offers_vendor_id_fkey;
alter table public.haggle_offers
  add constraint haggle_offers_vendor_id_fkey
  foreign key (vendor_id) references public.profiles(id) on delete cascade;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.haggle_offers'::regclass and contype = 'f';
