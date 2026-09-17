-- =====================================================
-- Fix: Supabase Security Advisor flags 8 functions with
-- "Function Search Path Mutable" (lint 0011) -- none of them
-- pin search_path, which means a role that can create objects
-- earlier in the resolution order (e.g. a same-named function/
-- table in a schema that comes before `public` on the caller's
-- search_path) could shadow what these functions actually call,
-- changing their behavior unexpectedly. This is a real, if
-- narrow, privilege-escalation surface for SECURITY DEFINER
-- functions especially (handle_new_user, create_vendor_profile_
-- if_missing) since those run with the function owner's
-- privileges.
--
-- Fix: pin search_path explicitly on each one, matching the
-- `set search_path = public` convention this codebase already
-- uses elsewhere (see fix-profiles-select-lockdown.sql). This
-- is pure hardening -- ALTER FUNCTION ... SET only changes a
-- config parameter, not the function body, so behavior is
-- otherwise unchanged.
--
-- Two of the eight take arguments (confirmed via
-- pg_get_function_identity_arguments against the live schema):
--   increment(row_id uuid, field text)
--   increment_unread(row_id uuid, field_name text)
-- The other six take none.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

alter function public.create_vendor_profile_if_missing() set search_path = public;
alter function public.generate_order_number() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.increment(row_id uuid, field text) set search_path = public;
alter function public.increment_unread(row_id uuid, field_name text) set search_path = public;
alter function public.notify_vendor_new_order() set search_path = public;
alter function public.touch_haggle_offers_updated_at() set search_path = public;
alter function public.update_stall_rating() set search_path = public;

-- ── Verify ───────────────────────────────────────────────
-- proconfig should show {search_path=public} for all 8 rows below.
select p.proname as function_name,
       pg_get_function_identity_arguments(p.oid) as arguments,
       p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'increment', 'increment_unread', 'touch_haggle_offers_updated_at',
    'create_vendor_profile_if_missing', 'notify_vendor_new_order',
    'generate_order_number', 'update_stall_rating', 'handle_new_user'
  )
order by p.proname;
