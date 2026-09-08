-- =====================================================
-- Migration: one rating per order
--
-- OrdersScreen.js's submitRating had no check for an existing rating on
-- an order — the "Rate Vendor" button never disabled itself either, so
-- nothing stopped a customer from rating the same order repeatedly and
-- skewing a stall's aggregate score. The client now checks and hides the
-- button once an order is rated, but that alone doesn't stop a second
-- request racing in before the first is reflected back (two tabs, a
-- double-tap, a direct API call) — only a DB constraint actually closes
-- that gap.
--
-- If any order already has more than one rating (from before this fix
-- shipped), the duplicate check below will list them — decide by hand
-- which one to keep before this migration can apply, since the unique
-- index will otherwise fail to create.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: any order with more than one rating already, which would
-- block the constraint below from being created.
select order_id, count(*) as rating_count
from public.ratings
where order_id is not null
group by order_id
having count(*) > 1;

alter table public.ratings
  add constraint ratings_order_id_unique unique (order_id);

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.ratings'::regclass and contype = 'u';
