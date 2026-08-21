-- ============================================================
-- PalengkeHub — Media Storage Setup
-- ------------------------------------------------------------
-- THE MISSING PIECE for product / profile picture / stall photo /
-- chat image uploads. Run this ONCE per Supabase project:
--   Supabase Dashboard → SQL Editor → New query → paste → Run
--
-- It is safe to re-run (idempotent).
-- ============================================================

-- 1) PRODUCT_IMAGES — PUBLIC bucket. Product photos, customer/vendor
--    avatar photos, stall photos and chat images are stored here
--    under the folders: products/, avatars/, stalls/, chat/
insert into storage.buckets (id, name, public)
values ('product_images', 'product_images', true)
on conflict (id) do update set public = excluded.public;

-- 2) VENDOR_DOCUMENTS — PRIVATE bucket (gov't IDs, signatures, receipts).
--    Only the uploader can read them; admins use the service role.
insert into storage.buckets (id, name, public)
values ('vendor_documents', 'vendor_documents', false)
on conflict (id) do update set public = excluded.public;

-- 3) Sanity limits (50 MB images, 10 MB documents)
update storage.buckets
set file_size_limit = 52428800
where id = 'product_images' and file_size_limit is null;

update storage.buckets
set file_size_limit = 10485760
where id = 'vendor_documents' and file_size_limit is null;

-- ============================================================
-- PRODUCT_IMAGES POLICIES
-- ============================================================

-- Remove any old/auto-generated policies first
drop policy if exists "Public read access for product_images" on storage.objects;
drop policy if exists "Authenticated users can upload to product_images" on storage.objects;
drop policy if exists "Authenticated users can update product_images" on storage.objects;
drop policy if exists "Authenticated users can delete product_images" on storage.objects;
drop policy if exists "Public read product_images" on storage.objects;
drop policy if exists "Authenticated upload product_images" on storage.objects;
drop policy if exists "Owners update product_images" on storage.objects;
drop policy if exists "Owners delete product_images" on storage.objects;

-- Anyone (logged in or not) can VIEW the product images
create policy "Public read product_images"
  on storage.objects for select
  using (bucket_id = 'product_images');

-- Any signed-in user (vendor or customer) can upload
create policy "Authenticated upload product_images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product_images');

-- Users can only overwrite / delete files they uploaded
create policy "Owners update product_images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product_images' and auth.uid()::text = owner_id::text);

create policy "Owners delete product_images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product_images' and auth.uid()::text = owner_id::text);

-- ============================================================
-- VENDOR_DOCUMENTS POLICIES (private)
-- ============================================================

drop policy if exists "Owners read vendor_documents" on storage.objects;
drop policy if exists "Authenticated upload vendor_documents" on storage.objects;
drop policy if exists "Owners update vendor_documents" on storage.objects;
drop policy if exists "Owners delete vendor_documents" on storage.objects;
drop policy if exists "Give users access to own folder vendor_documents" on storage.objects;

-- Only the uploader can view their own document
create policy "Owners read vendor_documents"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'vendor_documents' and auth.uid()::text = owner_id::text);

-- Signed-in users can upload a document
create policy "Authenticated upload vendor_documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'vendor_documents');

create policy "Owners update vendor_documents"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'vendor_documents' and auth.uid()::text = owner_id::text);

create policy "Owners delete vendor_documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'vendor_documents' and auth.uid()::text = owner_id::text);

-- ============================================================
-- DONE. Back in the app, re-try uploading:
--   Vendor  → Add/Edit Product → choose a photo
--   Customer → Profile → tap the avatar circle
-- ============================================================
