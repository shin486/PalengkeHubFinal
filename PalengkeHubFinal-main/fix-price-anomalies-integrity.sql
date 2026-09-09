-- =====================================================
-- Two real gaps found in price_anomalies while reviewing the daily
-- cron job, both confirmed live and already neutralized (the two
-- test rows this created, ids 5 and 6, were flipped to 'resolved' by
-- admin — nothing was left pending).
--
-- 1) CRITICAL — cross-vendor stall sabotage. The insert policy only
--    checked vendor_id = auth.uid(); it never verified that the
--    product_id/stall_id being flagged actually belongs to that
--    vendor. Confirmed live: logged in as vendor@palengkehub.com (who
--    owns only stall 1), I inserted a 'pending' anomaly naming
--    product 20 / stall 6 — someone else's stall entirely — and it
--    was accepted outright. Three days later, the daily cron
--    (create-price-anomaly-cron-job.sql) would have deactivated
--    stall 6 for real, with the "your stall was deactivated" message
--    going to MY notifications (vendor_id on the row), not stall 6's
--    actual owner — the victim would have gone dark with zero
--    warning. This is a working, delayed-fuse way to take down a
--    competitor's storefront using nothing but your own account.
--
-- 2) Enforcement bypass. "Vendors can resolve own anomaly" only
--    checked who owns the row and that pending/deactivated ->
--    resolved is the transition — never whether the vendor's price
--    is actually fixed. Confirmed live: flagged my own product at
--    ₱999 (566% over market), then PATCHed status straight to
--    'resolved' without touching the real price at all. The entire
--    point of the 3-day deadline / auto-deactivation is to force a
--    real correction; this let a vendor opt out of it for free.
--
-- Also added: an admin-only DELETE policy. There wasn't one at all —
-- not even admin could delete a row (confirmed: my own cleanup
-- attempt via the vendor session returned 200 with 0 rows deleted,
-- and admin has no delete policy either), so a mistaken or spam flag
-- could never actually be removed, only ever resolved/updated.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- 1) INSERT: the flagged product must actually belong to a stall the
-- inserting vendor owns, and the stall_id claimed must be that
-- product's real stall (not just any stall_id typed in alongside it).
drop policy if exists "Vendors can insert own auto anomaly" on public.price_anomalies;
create policy "Vendors can insert own auto anomaly" on public.price_anomalies
  for insert
  with check (
    vendor_id = auth.uid()
    and source = 'auto'
    and status = 'pending'
    and exists (
      select 1 from public.products p
      join public.stalls s on s.id = p.stall_id
      where p.id = price_anomalies.product_id
        and s.id = price_anomalies.stall_id
        and s.vendor_id = auth.uid()
    )
  );

-- 2) UPDATE: resolving your own flag requires the product's current
-- price to genuinely no longer be anomalous — same 50%-over-market-
-- average rule as priceAnomalyService.js's checkAnomaly(), just
-- re-verified server-side instead of trusted from the client. Admin
-- is exempt (a manual override/judgment call is still admin's to make).
create or replace function public.enforce_price_anomaly_resolve()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_name text;
  v_current_price numeric;
  v_avg numeric;
  v_count integer;
  v_diff_pct numeric;
begin
  if public.is_admin() then
    return new;
  end if;

  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    select name, price into v_product_name, v_current_price
      from public.products where id = new.product_id;

    if v_product_name is not null then
      select avg(price), count(*) into v_avg, v_count
        from public.products
        where name ilike '%' || v_product_name || '%' and price >= 0.01;

      if v_count >= 2 and v_avg > 0 then
        v_diff_pct := ((v_current_price - v_avg) / v_avg) * 100;
        if v_diff_pct >= 50 then
          raise exception 'Your price for % is still % percent above the market average (avg %) — lower it before this can be marked resolved',
            v_product_name, round(v_diff_pct), round(v_avg, 2);
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_price_anomaly_resolve on public.price_anomalies;
create trigger trg_enforce_price_anomaly_resolve
  before update on public.price_anomalies
  for each row
  execute function public.enforce_price_anomaly_resolve();

-- 3) DELETE: admin-only, so a mistaken or spam flag can actually be removed.
drop policy if exists "Admins can delete price anomalies" on public.price_anomalies;
create policy "Admins can delete price anomalies" on public.price_anomalies
  for delete
  using (public.is_admin());

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select policyname, cmd from pg_policies where tablename = 'price_anomalies' order by cmd;

select trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public' and event_object_table = 'price_anomalies';
