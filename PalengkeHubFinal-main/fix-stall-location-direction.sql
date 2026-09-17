-- =====================================================
-- Quick fix for seed-uat-stall-locations.sql + fix-missing-aling-
-- nena-location.sql: those extended new pins EAST (toward P. Torres
-- Street), but they should extend WEST (toward Rizal Street) instead.
--
-- This UPDATEs only the longitude of the 13 rows those two scripts
-- created -- latitude (the north/south spread) was fine and is left
-- alone. It does NOT touch your 3 real pre-existing pins.
--
-- Targeting "my" rows: matched by capture_method='manual_no_gps' AND
-- captured_by='admin' (what both scripts set) AND belonging to one of
-- the same 14 target stalls (8 UAT + 6 named + the Aling Nena one).
-- This assumes your 3 genuine pre-existing rows have captured_by =
-- 'vendor' (the normal self-registration path), not 'admin' -- if any
-- of those 3 real rows were ALSO captured_by='admin', this could touch
-- one of them too. Run the verify query first if you want to confirm
-- that assumption before trusting the update.
--
-- New longitude range: 121.1604239 to 121.1611239 -- capped at the
-- existing cluster's east edge (never goes further east/right than
-- your real pins) and extending ~75m west from there, toward Rizal
-- Street. Latitude range is unchanged from before.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

-- Sanity check first: confirms none of your 3 real pre-existing rows
-- are captured_by='admin' (which would make them look like "my" rows
-- below). If this returns any rows, STOP and tell me before running
-- the UPDATE -- it means the targeting assumption is wrong.
select sl.stall_id, sl.lat, sl.lng, sl.captured_by, sl.capture_method
from public.stall_locations sl
where sl.lng between 121.1610000 and 121.1612000
  and sl.lat between 13.9439000 and 13.9443000
  and sl.captured_by = 'admin';

update public.stall_locations sl
set lng = 121.1604239 + random() * (121.1611239 - 121.1604239)
from public.stalls s
where sl.stall_id = s.id
  and sl.captured_by = 'admin'
  and sl.capture_method = 'manual_no_gps'
  and (
    s.stall_number like 'UAT-%'
    or s.stall_name in (
      'Aling Nena',
      'Lordwig$ Veggies',
      'Fresh Veggies ni Aling Nena',
      'Isda ni Mang Lito',
      'Sweet Fruits ni Kuya Ben',
      'Rice & Grains ni Aling Rosa'
    )
    or (s.stall_number = '66 Pangao Ibaan Batangas' and s.section = 'Meat Section')
  );

-- ── Verify ───────────────────────────────────────────────
select s.stall_name, s.stall_number, sl.lat, sl.lng, sl.captured_by, sl.capture_method
from public.stall_locations sl
join public.stalls s on s.id = sl.stall_id
order by sl.captured_by, sl.lng;
