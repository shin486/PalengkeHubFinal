-- =====================================================
-- Follow-up to seed-uat-stall-locations.sql: the "Aling Nena" (Meat
-- Section) stall was skipped even though its stall_name displays
-- identically to the string that script matched against -- the stored
-- value almost certainly has an invisible character (trailing/leading
-- whitespace, a non-breaking space, etc.) that a plain `=` comparison
-- doesn't see past. Routing around that entirely by matching on
-- stall_number + section instead, both confirmed exactly via your
-- last query's result.
--
-- Same anchor/bounds and capture_method as seed-uat-stall-locations.sql
-- -- see that file for the full explanation of why these ranges.
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
where s.stall_number = '66 Pangao Ibaan Batangas'
  and s.section = 'Meat Section'
  and not exists (
    select 1 from public.stall_locations sl where sl.stall_id = s.id
  );

-- ── Verify ───────────────────────────────────────────────
select s.id, s.stall_name, s.stall_number, sl.lat, sl.lng, sl.capture_method
from public.stalls s
left join public.stall_locations sl on sl.stall_id = s.id
where s.stall_number = '66 Pangao Ibaan Batangas'
  and s.section = 'Meat Section';

-- Total should now be 3 (pre-existing) + 14 (from the main script,
-- assuming that one ran first) + 1 (this one) = 18, or 15 if you're
-- running this before the main script for some reason.
select count(*) as total_stall_locations from public.stall_locations;
