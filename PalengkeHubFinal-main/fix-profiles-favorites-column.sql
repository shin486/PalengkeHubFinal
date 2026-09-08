-- =====================================================
-- Fix: Favorites don't sync to the cloud — every read/write against
-- profiles.favorites returns "42703: column profiles.favorites does not
-- exist". useFavorites.js (src/hooks/useFavorites.js) has always assumed
-- this column exists (select/upsert on 'favorites' for logged-in users,
-- with a silent catch-and-fall-back to local AsyncStorage on failure) —
-- but it was never actually created on the live table. The app still
-- "works" because of that local fallback, so this went unnoticed: favorites
-- just never survive a reinstall or sync across a customer's devices.
--
-- Shape written by the app: { products: [...], stalls: [...] }
-- (see saveFavorites/clearAllFavorites in useFavorites.js).
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

alter table public.profiles
  add column if not exists favorites jsonb not null default '{"products": [], "stalls": []}'::jsonb;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'profiles' and column_name = 'favorites';
