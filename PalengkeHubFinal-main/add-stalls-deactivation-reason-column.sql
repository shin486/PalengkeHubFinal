-- =====================================================
-- Migration: stalls.deactivation_reason + reactivation cleanup trigger
--
-- stalls.is_active already gates whether customers can see/buy from
-- a stall (every customer browse/search screen filters on it) and
-- already gates whether a vendor can reach VendorDashboard at all
-- (App.js). The price anomaly feature needs to deactivate a stall
-- for a DIFFERENT reason than "never approved" — and unlike a fresh
-- applicant, a price-anomaly-suspended vendor must still be able to
-- log in (to fix the price and to chat with admin), just not sell.
-- deactivation_reason is how App.js tells the two cases apart and
-- routes to a different screen.
--
-- The trigger exists because is_active can be flipped back to true
-- from three different admin UI paths (a dedicated "Reactivate"
-- action, the existing Stalls page toggle, or the Edit-stall status
-- dropdown) — without it, reactivating through any path except a
-- brand-new dedicated one would leave deactivation_reason stale and
-- any price_anomalies row stuck at status='deactivated' forever.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
--   4. Run this AFTER create-price-anomalies-table.sql (the trigger
--      writes to price_anomalies).
-- =====================================================

alter table public.stalls
  add column if not exists deactivation_reason text;

create or replace function public.handle_stall_reactivation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Any false -> true transition, regardless of which admin control
  -- did it, clears the reason and resolves whatever price anomalies
  -- were the cause. Harmless no-op for a stall that was never
  -- deactivated for a price anomaly in the first place.
  if old.is_active = false and new.is_active = true then
    new.deactivation_reason := null;

    update public.price_anomalies
      set status = 'resolved', resolved_at = now()
      where stall_id = new.id and status = 'deactivated';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_handle_stall_reactivation on public.stalls;
create trigger trg_handle_stall_reactivation
  before update on public.stalls
  for each row execute function public.handle_stall_reactivation();

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'stalls' and column_name = 'deactivation_reason';
