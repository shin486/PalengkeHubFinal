-- =====================================================
-- Migration: products.image_urls (multi-photo support)
--
-- products.image_url has always held a single photo. Vendors now get
-- a photo gallery (up to 3 images) on Add/Edit Product, and customers
-- can swipe through them on ProductDetailsScreen. image_urls is a
-- jsonb array of signed storage URLs, images[0] === image_url always
-- (AddProductModal keeps them in sync), so every other screen that
-- still reads only image_url (ProductCard, search results, cart,
-- related products) keeps working unchanged for both old and new
-- products.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

alter table public.products
  add column if not exists image_urls jsonb;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'products' and column_name = 'image_urls';
