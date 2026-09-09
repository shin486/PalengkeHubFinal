-- =====================================================
-- promotions has the exact same shape of gap as price_anomalies
-- (see fix-price-anomalies-integrity.sql) — no policy definitions in
-- any tracked SQL file, and useVendorPromotions.js trusts RLS for
-- 100% of its access control:
--
--   createPromotion(): inserts stall_id from a plain hook argument,
--   never checked against the caller.
--   updatePromotion() / togglePromotion() / deletePromotion(): all
--   filter ONLY by the promotion's own id — no ownership check at
--   the app layer at all.
--
-- If the current RLS is as permissive as the other tables already
-- found this session, any vendor can plant a fake promotion pointing
-- at a COMPETITOR's stall/product (junk content, or a wildly wrong
-- discount misrepresenting their pricing), or edit/delete a
-- competitor's real active promotion by guessing/enumerating its id
-- — sabotaging their sale.
--
-- promotions are customer-facing marketing content shown across
-- HomeScreen/SearchScreen/CategoryProductsScreen/ProductDetailsScreen
-- to anyone browsing (even signed-out), so SELECT stays public —
-- only the write side needed locking down.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: current state before touching anything.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'promotions';

select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename = 'promotions'
order by cmd;

alter table public.promotions enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where tablename = 'promotions'
  loop
    execute format('drop policy if exists %I on public.promotions', pol.policyname);
  end loop;
end $$;

create policy "Anyone can view promotions"
  on public.promotions for select
  using (true);

create policy "Vendor can create promotion for own stall+product"
  on public.promotions for insert
  with check (
    exists (select 1 from public.stalls s where s.id = promotions.stall_id and s.vendor_id = auth.uid())
    and exists (select 1 from public.products p where p.id = promotions.product_id and p.stall_id = promotions.stall_id)
  );

create policy "Vendor can update own promotion"
  on public.promotions for update
  using (exists (select 1 from public.stalls s where s.id = promotions.stall_id and s.vendor_id = auth.uid()))
  with check (
    stall_id = (select pr.stall_id from public.promotions pr where pr.id = promotions.id)
    and product_id = (select pr.product_id from public.promotions pr where pr.id = promotions.id)
  );

create policy "Vendor can delete own promotion"
  on public.promotions for delete
  using (exists (select 1 from public.stalls s where s.id = promotions.stall_id and s.vendor_id = auth.uid()));

create policy "Admins can update any promotion"
  on public.promotions for update
  using (public.is_admin());

create policy "Admins can delete any promotion"
  on public.promotions for delete
  using (public.is_admin());

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename = 'promotions'
order by cmd, policyname;
