-- =====================================================
-- Seed map-pin coordinates (public.stall_locations) for:
--   - the 8 UAT vendor stalls (stall_number LIKE 'UAT-%')
--   - 6 other named test vendors already visible in the Market
--     Stalls directory with no pin yet: Aling Nena, Lordwig$
--     Veggies, Fresh Veggies ni Aling Nena, Isda ni Mang Lito,
--     Sweet Fruits ni Kuya Ben, Rice & Grains ni Aling Rosa
--
-- Anchored to REAL existing data, not a guessed address: you
-- shared the 3 rows already in stall_locations --
--   (13.9442820, 121.1610582), (13.9441454, 121.1610543),
--   (13.9439624, 121.1611239) -- all manual_no_gps, clustered in
-- a ~35m x 8m patch matching the 3 red pins in your map
-- screenshot (upper-right portion of the Wet Market building,
-- near P. Torres Street).
--
-- Per your instruction, every new point:
--   - uses capture_method = 'manual_no_gps' (matching the
--     existing rows -- no real GPS reading was taken)
--   - never goes further WEST (lower longitude) than the
--     existing cluster's westmost point (121.1610543), since
--     that would place a pin outside the building, past its
--     left/Rizal Street wall
--   - stays within a box anchored at that same west edge,
--     extending only east/north/south into the rest of the
--     building: lat 13.9435624-13.9447820 (~135m N-S), lng
--     121.16105-121.16165 (~65m E-W, comfortably short of
--     P. Torres Street)
--
-- accuracy_meters is left NULL for all of these -- a manually
-- placed pin (capture_method = manual_no_gps) has no real GPS
-- accuracy reading to report; filling in a fake meters value
-- would misrepresent it as more precise than it is.
--
-- Safe to re-run: skips any stall that already has a
-- stall_locations row (whether from this script or the 3 that
-- already existed).
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

insert into public.stall_locations (
  stall_id, lat, lng, accuracy_meters, captured_by, captured_at,
  capture_method, manually_adjusted, verified_by_admin, verified_at, is_current
)
select
  s.id,
  13.9435624 + random() * (13.9447820 - 13.9435624),
  121.16105 + random() * (121.16165 - 121.16105),
  null,
  'admin',
  now(),
  'manual_no_gps',
  false,
  true,
  now(),
  true
from public.stalls s
where (
    s.stall_number like 'UAT-%'
    or s.stall_name in (
      'Aling Nena',
      'Lordwig$ Veggies',
      'Fresh Veggies ni Aling Nena',
      'Isda ni Mang Lito',
      'Sweet Fruits ni Kuya Ben',
      'Rice & Grains ni Aling Rosa'
    )
  )
  and not exists (
    select 1 from public.stall_locations sl where sl.stall_id = s.id
  );

-- ── Verify ───────────────────────────────────────────────
-- Should show all 3 pre-existing rows plus up to 14 new ones (fewer if
-- any of the 6 named vendors weren't found by exact stall_name match --
-- check the "matched" list below against this count).
select count(*) as total_stall_locations from public.stall_locations;

select s.stall_name, s.stall_number, sl.lat, sl.lng, sl.capture_method, sl.captured_at
from public.stall_locations sl
join public.stalls s on s.id = sl.stall_id
order by sl.captured_at desc
limit 20;

-- Sanity check: confirms none of the 6 named vendors were silently
-- skipped because the stall_name text didn't match exactly.
select name
from (values
  ('Aling Nena'), ('Lordwig$ Veggies'), ('Fresh Veggies ni Aling Nena'),
  ('Isda ni Mang Lito'), ('Sweet Fruits ni Kuya Ben'), ('Rice & Grains ni Aling Rosa')
) as expected(name)
where not exists (
  select 1 from public.stalls s where s.stall_name = expected.name
);
