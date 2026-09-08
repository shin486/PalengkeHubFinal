-- =====================================================
-- Fix: Submitting a customer report always fails — "invalid input
-- syntax for type uuid" — and the error is invisible to the customer
-- (the catch block's Alert.alert('Error', ...) is itself a silent
-- no-op on web, same class of bug as the rest of this session's
-- fixes), so the form just sits there looking like nothing happened.
--
-- Root cause: customer_reports.target_id was created as uuid, but
-- every real caller sends a bigint — ReportIssueScreen.js's insert
-- receives targetId from ProductDetailsScreen.js (product.id) or
-- StallDetailsScreen.js (stall.id), and both products.id and
-- stalls.id are bigint, never uuid, throughout this schema. Likely
-- just copy-pasted the uuid convention from a user-id-shaped column
-- (profiles.id / auth.users.id) without checking what this one
-- actually needs to hold.
--
-- This changes the column to bigint (still nullable — the "New
-- Report" entry point in CustomerReportsScreen.js navigates with no
-- target at all). No real data is lost: reproducing the live error
-- confirms every existing submission attempt already failed before
-- ever reaching the table, so there's nothing stored under the old
-- type to convert.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: confirm the column's current type before touching it.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'customer_reports' and column_name = 'target_id';

alter table public.customer_reports
  alter column target_id type bigint using null;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'customer_reports' and column_name = 'target_id';
