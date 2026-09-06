-- =====================================================
-- Seed: sample reviews for "Test Vendor Stall" (testing only)
--
-- StallReviewsScreen.js (new customer-facing "Reviews" screen, reached
-- by tapping the rating/review-count row on StallDetailsScreen) reads
-- real rows from public.ratings — the same table VendorRatingsScreen
-- and the customer "rate your order" flow (OrdersScreen.js) already
-- use. There weren't any rows for the test stall, so both that screen
-- and the real average/count now shown on StallDetailsScreen would
-- show the true empty state. This inserts a handful of realistic
-- sample reviews so there's something to look at while testing.
--
-- Uses whatever customer profiles already exist in this project — no
-- hardcoded UUIDs — cycling through up to 5 of them. Safe to run as-is.
--
-- If this errors mentioning order_id (NOT NULL violation): the
-- ratings table wasn't tracked in any migration file in this repo, so
-- its exact constraints weren't knowable ahead of time. Paste the
-- error back and it's a one-line fix.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

-- Diagnostic: confirm ratings' real shape before inserting into it.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'ratings'
order by ordinal_position;

do $$
declare
  v_stall_id bigint;
  v_customers uuid[];
  n int;
  v_pork_liempo bigint;
  v_chicken_breast bigint;
  v_pork_shoulder bigint;
begin
  select id into v_stall_id from public.stalls where stall_name = 'Test Vendor Stall' limit 1;
  if v_stall_id is null then
    raise notice 'Test Vendor Stall not found — nothing inserted.';
    return;
  end if;

  select array_agg(id) into v_customers from (
    select id from public.profiles
    where coalesce(role, 'customer') not in ('vendor', 'admin')
    order by created_at
    limit 5
  ) s;
  n := coalesce(array_length(v_customers, 1), 0);
  if n = 0 then
    raise notice 'No customer profiles found — nothing inserted.';
    return;
  end if;

  select id into v_pork_liempo from public.products where stall_id = v_stall_id and name = 'Pork Liempo' limit 1;
  select id into v_chicken_breast from public.products where stall_id = v_stall_id and name = 'Chicken Breast' limit 1;
  select id into v_pork_shoulder from public.products where stall_id = v_stall_id and name = 'Pork Shoulder' limit 1;

  insert into public.ratings (consumer_id, stall_id, product_id, rating, review, vendor_reply, vendor_reply_at, created_at) values
    (v_customers[(0 % n) + 1], v_stall_id, v_pork_liempo,    5, 'Sariwa talaga ang karne, sulit sa presyo. Babalik ako dito!', 'Salamat po sa suporta! Aabangan namin kayo ulit.', now() - interval '2 days', now() - interval '3 days'),
    (v_customers[(1 % n) + 1], v_stall_id, v_chicken_breast, 4, 'Maayos ang pagkaka-pack, mabilis din makuha. Sana mas mura pa next time.', null, null, now() - interval '6 days'),
    (v_customers[(2 % n) + 1], v_stall_id, v_pork_shoulder,  5, 'Ang bait ng tindera, tinulungan pa ako pumili ng cut. Recommended!', null, null, now() - interval '9 days'),
    (v_customers[(3 % n) + 1], v_stall_id, null,             3, 'Okay lang, medyo mahaba ang pila noong Sabado.', null, null, now() - interval '13 days'),
    (v_customers[(4 % n) + 1], v_stall_id, v_pork_liempo,    5, 'Best liempo sa palengke, sulit!', null, null, now() - interval '20 days');

  raise notice 'Inserted 5 sample reviews using % distinct customer profile(s) for stall %.', n, v_stall_id;
end $$;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select r.id, r.rating, r.review, r.vendor_reply, p.full_name as consumer, pr.name as product, r.created_at
from public.ratings r
join public.stalls s on s.id = r.stall_id
left join public.profiles p on p.id = r.consumer_id
left join public.products pr on pr.id = r.product_id
where s.stall_name = 'Test Vendor Stall'
order by r.created_at desc;
