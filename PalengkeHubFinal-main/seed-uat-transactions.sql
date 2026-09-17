-- =====================================================
-- Seed completed transaction history between the 20 UAT
-- consumers and 8 UAT vendors created by
-- seed-uat-respondents.sql -- run that script FIRST.
--
-- This creates, purely as historical database records (no
-- app interaction, no chat, nothing sent through Supabase's
-- real APIs):
--   1. Products for each of the 8 vendor stalls (they had
--      none yet -- needed because orders.items is validated
--      against real product prices by a trigger).
--   2. Completed orders: each of the 20 consumers gets a
--      RANDOM number of orders (1-3, everyone gets at least
--      one), each against a randomly
--      picked vendor and 1-3 of that vendor's products,
--      quantities 1-3 (kg). Dated randomly on 2026-08-05 or
--      2026-08-06, between 11:00 AM and 4:00 PM.
--   3. One rating (4 or 5 stars, short comment) per completed
--      order, a few minutes after the order.
--   4. A receipt-style entry in public.audit_log for every
--      order (action='order_completed'), with consumer/vendor
--      names, item breakdown, and total paid.
--   5. 2 consumers each get an extra "shopping trip" -- 3-4
--      orders placed at the same timestamp against different
--      vendors, simulating checking out from several stalls in
--      one session (this data model has no multi-vendor cart/
--      order; carts and orders are both per-stall, so a
--      multi-vendor trip is modeled as several order rows for
--      the same consumer, same moment, different stall_id).
--
-- Why every product is priced "per kg": public.orders has a
-- BEFORE INSERT trigger (enforce_order_item_prices) that
-- recomputes each item's price from products.price using a
-- unit multiplier table (kg=1.00, piece=0.25, dozen=2.40,
-- etc.) and rejects the insert if item.price doesn't match
-- EXACTLY, and separately requires subtotal = total_amount =
-- sum(price*qty) exactly. Using unit='kg' everywhere makes
-- the multiplier 1.00, so item.price can just equal
-- products.price directly -- no rounding/multiplier math to
-- get wrong. total_amount is set equal to subtotal (no
-- separate delivery fee column exists on orders).
--
-- Assumptions this script makes about your schema (based on
-- code inspection, not a live query) -- if any INSERT fails
-- with a column/type error, tell me the exact error and I'll
-- adjust:
--   - orders.id and products.id are auto-generated (identity/
--     serial), so they're never set explicitly here.
--   - orders has: order_number, consumer_id, stall_id, items
--     (jsonb), subtotal, total_amount, status, payment_status,
--     payment_method, pickup_time, created_at.
--   - ratings has: consumer_id, stall_id, product_id, order_id,
--     rating, review, created_at, and its own trigger requires
--     the referenced order to already be status='completed'
--     with matching consumer_id/stall_id (satisfied here since
--     the order is inserted as 'completed' before its rating).
--
-- How to apply:
--   1. Run seed-uat-respondents.sql first, if you haven't.
--   2. Open https://supabase.com/dashboard
--   3. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   4. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

-- ── 1) Products ──────────────────────────────────────────
-- Skipped for a stall if it already has products (safe to
-- re-run without duplicating).
insert into public.products (stall_id, name, description, price, unit, category, is_available, stock_quantity)
select s.id, v.name, v.description, v.price, 'kg', v.category, true, v.stock
from public.stalls s
join (
  values
    ('UAT-01', 'Dinorado Rice',      'Premium local dinorado rice',        58.00, 'Rice',       80),
    ('UAT-01', 'Sinandomeng Rice',   'Everyday sinandomeng rice',          48.00, 'Rice',       100),
    ('UAT-01', 'Brown Rice',         'Healthy brown rice',                 65.00, 'Rice',       40),

    ('UAT-02', 'Lakatan Banana',     'Sweet ripe lakatan bananas',         70.00, 'Fruits',     60),
    ('UAT-02', 'Carabao Mango',      'Sweet carabao mangoes',             120.00, 'Fruits',     50),
    ('UAT-02', 'Papaya',             'Ripe papaya',                        45.00, 'Fruits',     40),
    ('UAT-02', 'Watermelon',         'Fresh sweet watermelon',             35.00, 'Fruits',     30),

    ('UAT-03', 'Kangkong',           'Fresh water spinach',                25.00, 'Vegetables', 70),
    ('UAT-03', 'Pechay',             'Fresh pechay',                       40.00, 'Vegetables', 60),
    ('UAT-03', 'Kalabasa',           'Fresh squash',                       35.00, 'Vegetables', 50),
    ('UAT-03', 'Sitaw',              'Fresh string beans',                 50.00, 'Vegetables', 45),

    ('UAT-04', 'Pork Liempo',        'Fresh pork belly',                  280.00, 'Meat',       40),
    ('UAT-04', 'Whole Chicken',      'Fresh dressed chicken',             180.00, 'Poultry',    35),
    ('UAT-04', 'Giniling na Baboy',  'Fresh ground pork',                 260.00, 'Meat',       30),

    ('UAT-05', 'Beef Brisket',       'Fresh beef brisket',                380.00, 'Meat',       25),
    ('UAT-05', 'Pork Chop',          'Fresh pork chop cuts',              270.00, 'Meat',       35),
    ('UAT-05', 'Chicken Breast',     'Fresh chicken breast fillet',       190.00, 'Poultry',    30),

    ('UAT-06', 'Bangus',             'Fresh milkfish',                    180.00, 'Seafood',    45),
    ('UAT-06', 'Tilapia',            'Fresh tilapia',                     140.00, 'Seafood',    50),
    ('UAT-06', 'Hipon',              'Fresh shrimp',                      320.00, 'Seafood',    25),
    ('UAT-06', 'Pusit',              'Fresh squid',                       280.00, 'Seafood',    20),

    ('UAT-07', 'Kamatis',            'Fresh tomatoes',                     60.00, 'Vegetables', 55),
    ('UAT-07', 'Talong',             'Fresh eggplant',                     50.00, 'Vegetables', 45),
    ('UAT-07', 'Okra',               'Fresh okra',                         45.00, 'Vegetables', 40),
    ('UAT-07', 'Ampalaya',           'Fresh bitter gourd',                 55.00, 'Vegetables', 35),

    ('UAT-08', 'Tokwa',              'Fresh tofu',                         40.00, 'Wet Goods',  60),
    ('UAT-08', 'Itlog',              'Fresh eggs, sold per kilo',         190.00, 'Wet Goods',  50),
    ('UAT-08', 'Tuyo',               'Dried fish',                        220.00, 'Wet Goods',  30)
) as v(stall_number, name, description, price, category, stock)
  on s.stall_number = v.stall_number
where s.stall_number like 'UAT-%'
  and not exists (
    select 1 from public.products p2 where p2.stall_id = s.id
  );

-- Sanity check: should be 28 (or 0 if products already existed from a prior run).
select count(*) as products_inserted_this_run from public.products p
join public.stalls s on s.id = p.stall_id
where s.stall_number like 'UAT-%';

-- ── 2) Orders + 3) Ratings ───────────────────────────────
do $$
declare
  r_consumer   record;
  r_stall      record;
  r_product    record;
  v_num_orders int;
  v_num_items  int;
  v_num_stalls int;
  v_order_id   bigint;
  v_items      jsonb;
  v_subtotal   numeric;
  v_created_at timestamptz;
  v_qty        int;
  v_price      numeric;
  v_first_product_id bigint;
  v_rating     int;
  v_review     text;
  v_order_no   text;
  v_payment_ref text;
  v_items_summary text;
  v_receipt_details text;
  reviews text[] := array[
    'Sariwa ang paninda, mabilis pa ang pickup!',
    'Maganda ang presyo at maayos ang pagkakabalot.',
    'Salamat sa mabilis na proseso, babalik ulit ako dito.',
    'Fresh talaga ang mga paninda, worth it!',
    'Maayos ang transaksyon, walang problema.',
    'Ang bait ng vendor, sulit ang bili.',
    'Okay lang, pero medyo mahaba yung pila sa pickup.',
    'Sulit ang presyo kumpara sa ibang tindahan.'
  ];
begin
  for r_consumer in
    select id as consumer_id, full_name
    from public.profiles
    where role = 'consumer'
      and email like '%@gmail.com'
      and created_at between '2026-08-05' and '2026-08-07'
  loop
    v_num_orders := 1 + floor(random() * 3)::int; -- 1..3

    for i in 1..v_num_orders loop
      select s.id as stall_id, s.stall_name
      into r_stall
      from public.stalls s
      where s.stall_number like 'UAT-%'
      order by random()
      limit 1;

      v_created_at :=
        (case when random() < 0.5 then timestamp '2026-08-05 00:00:00' else timestamp '2026-08-06 00:00:00' end)
        + interval '11 hours' + (random() * interval '5 hours');

      v_num_items := 1 + floor(random() * 3)::int; -- 1..3
      v_items := '[]'::jsonb;
      v_subtotal := 0;
      v_first_product_id := null;
      v_items_summary := '';

      for r_product in
        select p.id, p.name, p.price
        from public.products p
        where p.stall_id = r_stall.stall_id
        order by random()
        limit v_num_items
      loop
        if v_first_product_id is null then
          v_first_product_id := r_product.id;
        end if;

        v_qty := 1 + floor(random() * 3)::int; -- 1..3 kg
        v_price := r_product.price;

        v_items := v_items || jsonb_build_array(jsonb_build_object(
          'id', r_product.id,
          'name', r_product.name,
          'price', v_price,
          'quantity', v_qty,
          'unit', 'kg'
        ));
        v_subtotal := v_subtotal + (v_price * v_qty);
        v_items_summary := v_items_summary
          || (case when v_items_summary = '' then '' else ', ' end)
          || r_product.name || ' x' || v_qty || 'kg (PHP ' || v_price || '/kg)';
      end loop;

      if jsonb_array_length(v_items) = 0 then
        continue; -- stall had no products somehow; skip this attempt
      end if;

      v_order_no := 'UAT-' || to_char(v_created_at, 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
      v_payment_ref := 'GC' || substr(md5(random()::text), 1, 10);

      insert into public.orders (
        order_number, consumer_id, stall_id, items, subtotal, total_amount,
        status, payment_status, payment_method, payment_reference,
        pickup_time, paid_at, created_at, updated_at
      ) values (
        v_order_no,
        r_consumer.consumer_id,
        r_stall.stall_id,
        v_items,
        v_subtotal,
        v_subtotal,
        'completed',
        'paid',
        'gcash',
        v_payment_ref,
        v_created_at,
        v_created_at,
        v_created_at,
        v_created_at
      )
      returning id into v_order_id;

      v_rating := 4 + floor(random() * 2)::int; -- 4 or 5
      v_review := reviews[1 + floor(random() * array_length(reviews, 1))::int];

      insert into public.ratings (
        consumer_id, stall_id, product_id, order_id, rating, review, created_at
      ) values (
        r_consumer.consumer_id,
        r_stall.stall_id,
        v_first_product_id,
        v_order_id,
        v_rating,
        v_review,
        v_created_at + interval '10 minutes'
      );

      -- Receipt-style audit log entry for this transaction: who, from
      -- whom, what was bought, and how much was paid.
      v_receipt_details := 'Order ' || v_order_no || ' completed. Consumer: ' || r_consumer.full_name
        || '. Vendor: ' || r_stall.stall_name
        || '. Items: ' || v_items_summary
        || '. Subtotal: PHP ' || v_subtotal
        || '. Total paid: PHP ' || v_subtotal
        || '. Payment method: GCash. Payment reference: ' || v_payment_ref || '.';

      insert into public.audit_log (
        action, table_name, record_id, details, user_id, created_at
      ) values (
        'order_completed',
        'orders',
        v_order_id::text,
        v_receipt_details,
        r_consumer.consumer_id,
        v_created_at + interval '1 minute'
      );
    end loop;
  end loop;

  -- Extra: 2 consumers who shop from several vendors in one trip. Since a
  -- "checkout" here is always per-stall (orders.stall_id is singular, and
  -- carts are per-stall too), a multi-vendor shopping session is modeled
  -- as several order rows for the same consumer against different stalls,
  -- all placed at essentially the same moment.
  for r_consumer in
    select id as consumer_id, full_name
    from public.profiles
    where role = 'consumer'
      and email like '%@gmail.com'
      and created_at between '2026-08-05' and '2026-08-07'
    order by random()
    limit 2
  loop
    v_created_at :=
      (case when random() < 0.5 then timestamp '2026-08-05 00:00:00' else timestamp '2026-08-06 00:00:00' end)
      + interval '11 hours' + (random() * interval '5 hours');

    v_num_stalls := 3 + floor(random() * 2)::int; -- 3 or 4 distinct stalls

    for r_stall in
      select s.id as stall_id, s.stall_name
      from public.stalls s
      where s.stall_number like 'UAT-%'
      order by random()
      limit v_num_stalls
    loop
      v_num_items := 1 + floor(random() * 3)::int; -- 1..3
      v_items := '[]'::jsonb;
      v_subtotal := 0;
      v_first_product_id := null;
      v_items_summary := '';

      for r_product in
        select p.id, p.name, p.price
        from public.products p
        where p.stall_id = r_stall.stall_id
        order by random()
        limit v_num_items
      loop
        if v_first_product_id is null then
          v_first_product_id := r_product.id;
        end if;

        v_qty := 1 + floor(random() * 3)::int; -- 1..3 kg
        v_price := r_product.price;

        v_items := v_items || jsonb_build_array(jsonb_build_object(
          'id', r_product.id,
          'name', r_product.name,
          'price', v_price,
          'quantity', v_qty,
          'unit', 'kg'
        ));
        v_subtotal := v_subtotal + (v_price * v_qty);
        v_items_summary := v_items_summary
          || (case when v_items_summary = '' then '' else ', ' end)
          || r_product.name || ' x' || v_qty || 'kg (PHP ' || v_price || '/kg)';
      end loop;

      if jsonb_array_length(v_items) = 0 then
        continue;
      end if;

      v_order_no := 'UAT-' || to_char(v_created_at, 'YYYYMMDD') || '-' || substr(md5(random()::text), 1, 6);
      v_payment_ref := 'GC' || substr(md5(random()::text), 1, 10);

      insert into public.orders (
        order_number, consumer_id, stall_id, items, subtotal, total_amount,
        status, payment_status, payment_method, payment_reference,
        pickup_time, paid_at, created_at, updated_at
      ) values (
        v_order_no,
        r_consumer.consumer_id,
        r_stall.stall_id,
        v_items,
        v_subtotal,
        v_subtotal,
        'completed',
        'paid',
        'gcash',
        v_payment_ref,
        v_created_at,
        v_created_at,
        v_created_at,
        v_created_at
      )
      returning id into v_order_id;

      v_rating := 4 + floor(random() * 2)::int; -- 4 or 5
      v_review := reviews[1 + floor(random() * array_length(reviews, 1))::int];

      insert into public.ratings (
        consumer_id, stall_id, product_id, order_id, rating, review, created_at
      ) values (
        r_consumer.consumer_id,
        r_stall.stall_id,
        v_first_product_id,
        v_order_id,
        v_rating,
        v_review,
        v_created_at + interval '10 minutes'
      );

      v_receipt_details := 'Order ' || v_order_no || ' completed (multi-vendor checkout session). Consumer: '
        || r_consumer.full_name || '. Vendor: ' || r_stall.stall_name
        || '. Items: ' || v_items_summary
        || '. Subtotal: PHP ' || v_subtotal
        || '. Total paid: PHP ' || v_subtotal
        || '. Payment method: GCash. Payment reference: ' || v_payment_ref || '.';

      insert into public.audit_log (
        action, table_name, record_id, details, user_id, created_at
      ) values (
        'order_completed',
        'orders',
        v_order_id::text,
        v_receipt_details,
        r_consumer.consumer_id,
        v_created_at + interval '1 minute'
      );
    end loop;
  end loop;
end $$;

-- Keep stalls.average_rating / total_ratings consistent with the ratings
-- just inserted -- harmless to run even if some other trigger already
-- maintains these columns elsewhere.
update public.stalls s
set average_rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.ratings r where r.stall_id = s.id), 0),
    total_ratings = coalesce((select count(*) from public.ratings r where r.stall_id = s.id), 0)
where s.stall_number like 'UAT-%';

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select count(*) as total_orders_created
from public.orders o
where o.created_at between '2026-08-05 00:00:00' and '2026-08-06 23:59:59'
  and o.status = 'completed';

-- Consumers who ordered from 3+ different vendors within the same minute
-- (the multi-vendor "shopping trip" sessions).
select p.full_name as consumer, o.created_at,
       count(distinct o.stall_id) as vendors_in_session,
       string_agg(distinct s.stall_name, ', ') as vendors,
       sum(o.total_amount) as session_total
from public.orders o
join public.profiles p on p.id = o.consumer_id
join public.stalls s on s.id = o.stall_id
where s.stall_number like 'UAT-%'
group by p.full_name, o.consumer_id, o.created_at
having count(distinct o.stall_id) >= 3
order by o.created_at;

select p.full_name as consumer, s.stall_name as vendor, o.order_number,
       o.items, o.subtotal, o.total_amount, o.status, o.payment_status, o.created_at
from public.orders o
join public.profiles p on p.id = o.consumer_id
join public.stalls s on s.id = o.stall_id
where s.stall_number like 'UAT-%'
order by o.created_at;

select r.rating, r.review, p.full_name as consumer, s.stall_name as vendor, r.created_at
from public.ratings r
join public.profiles p on p.id = r.consumer_id
join public.stalls s on s.id = r.stall_id
where s.stall_number like 'UAT-%'
order by r.created_at;

select s.stall_name, count(distinct o.id) as orders_received,
       s.average_rating, s.total_ratings
from public.stalls s
left join public.orders o on o.stall_id = s.id and o.status = 'completed'
where s.stall_number like 'UAT-%'
group by s.stall_name, s.average_rating, s.total_ratings
order by orders_received desc;
