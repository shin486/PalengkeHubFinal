-- =====================================================
-- products — the same gap shape as promotions/price_anomalies, but on
-- the single most consequential table in the marketplace. No policy
-- definitions in any tracked SQL file, and useVendorProducts.js
-- trusts RLS for 100% of its access control:
--
--   addProduct(): inserts stall_id from a plain hook argument, never
--   checked against the caller.
--   updateProduct(productId, updates) / deleteProduct(productId):
--   both filter ONLY by the product's own id — no ownership check at
--   the app layer at all.
--
-- If the current RLS is as permissive as the other tables already
-- found this session, any vendor account can:
--   - zero out a competitor's stock_quantity or price
--   - flip is_available to false on a competitor's listing
--   - delete a competitor's product outright
--   - insert a fake product under a competitor's stall_id
-- just by knowing/guessing a product id or stall id — no order, no
-- price-anomaly flag, nothing else involved. This is upstream of
-- every other price/order integrity fix already applied this
-- session: those all assume the product row itself is trustworthy.
--
-- Products are the core catalog customers browse everywhere
-- (Home/Search/Category/StallDetails/ProductDetails, even signed
-- out), so SELECT stays public — only the write side needed locking
-- down.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: current state before touching anything.
select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'products';

select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename = 'products'
order by cmd;

alter table public.products enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies where tablename = 'products'
  loop
    execute format('drop policy if exists %I on public.products', pol.policyname);
  end loop;
end $$;

create policy "Anyone can view products"
  on public.products for select
  using (true);

create policy "Vendor can add product to own stall"
  on public.products for insert
  with check (
    exists (select 1 from public.stalls s where s.id = products.stall_id and s.vendor_id = auth.uid())
  );

-- stall_id is pinned in with_check so an update can't reassign a
-- product to a different stall (either "steal" one from a competitor
-- or give one of your own away).
create policy "Vendor can update own product"
  on public.products for update
  using (exists (select 1 from public.stalls s where s.id = products.stall_id and s.vendor_id = auth.uid()))
  with check (
    stall_id = (select p.stall_id from public.products p where p.id = products.id)
  );

create policy "Vendor can delete own product"
  on public.products for delete
  using (exists (select 1 from public.stalls s where s.id = products.stall_id and s.vendor_id = auth.uid()));

create policy "Admins can update any product"
  on public.products for update
  using (public.is_admin());

create policy "Admins can delete any product"
  on public.products for delete
  using (public.is_admin());

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select tablename, policyname, cmd, qual, with_check
from pg_policies where tablename = 'products'
order by cmd, policyname;
