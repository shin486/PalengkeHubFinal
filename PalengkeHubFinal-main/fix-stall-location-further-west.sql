-- =====================================================
-- Follow-up to fix-stall-location-direction.sql: that fix capped the
-- east edge at the MAX of your 3 real pins' longitude (121.1611239),
-- so a pin could still land as far east as your easternmost real pin --
-- which, combined with the building's actual shape, was enough to put
-- several pins across P. Torres Street entirely (Tagumpay S-Mart block,
-- etc.), not just "a bit east of ideal."
--
-- This caps the east edge at the MIN of your 3 real pins instead
-- (121.1610543) -- so no pin this touches can ever be at or east of
-- ANY of your real pins, only west of all three -- and extends about
-- 90m further west from there, toward Rizal Street, comfortably inside
-- the Wet Market / Lipa City Public Market building footprint.
--
-- Same targeting as before (captured_by='admin' AND capture_method=
-- 'manual_no_gps', matching the 8 UAT + 6 named + Aling Nena stalls) --
-- only touches rows this session created, never your real pins.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

-- Sanity check first: confirms none of your real pre-existing pins are
-- captured_by='admin'. Same check as before -- if this returns any
-- rows, STOP and tell me before running the UPDATE below.
select sl.stall_id, sl.lat, sl.lng, sl.captured_by, sl.capture_method
from public.stall_locations sl
where sl.lng between 121.1608000 and 121.1613000
  and sl.lat between 13.9439000 and 13.9443000
  and sl.captured_by = 'admin';

update public.stall_locations sl
set lng = 121.1601543 + random() * (121.1610543 - 121.1601543)
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
-- Every row here should now have lng <= 121.1610543 (at or west of
-- your westernmost real pin) for captured_by='admin' rows, while the
-- captured_by <> 'admin' rows (your real pins) stay untouched.
select s.stall_name, s.stall_number, sl.lat, sl.lng, sl.captured_by, sl.capture_method
from public.stall_locations sl
join public.stalls s on s.id = sl.stall_id
order by sl.captured_by, sl.lng;
