-- =====================================================
-- URGENT regression — found while explaining the haggle system, not
-- through deliberate security testing this time.
--
-- fix-full-security-sweep.sql's enforce_order_item_prices() trigger
-- (which re-validates every checkout item's price against the real
-- current price) only ever checks products.price and an active
-- promotions.discounted_price. It never checks haggle_offers. Since
-- useCart.js applies an accepted haggle's negotiated current_price
-- onto the cart item automatically, EVERY checkout for a customer
-- with an accepted haggle offer has been rejected outright since that
-- trigger went live — confirmed live: accepted a ₱120 offer on a
-- ₱160 product, then tried to place an order at ₱120 (exactly what
-- the real checkout code does), and got "Item price does not match
-- the current listed price (expected 160.00, got 120)".
--
-- Fix: the trigger now also checks for an 'accepted' haggle_offers
-- row for this exact consumer_id + product + unit, and treats its
-- current_price as valid — matching useCart.js's own logic exactly
-- (an accepted haggle always overrides the listed/promo price, it
-- doesn't get compared against them).
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

create or replace function public.enforce_order_item_prices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product_id bigint;
  v_claimed_price numeric;
  v_claimed_qty numeric;
  v_base_price numeric;
  v_promo_price numeric;
  v_haggle_price numeric;
  v_valid_price numeric;
  v_computed_subtotal numeric := 0;
begin
  for v_item in select * from jsonb_array_elements(new.items)
  loop
    v_product_id := (v_item->>'id')::bigint;
    v_claimed_price := (v_item->>'price')::numeric;
    v_claimed_qty := (v_item->>'quantity')::numeric;

    select price into v_base_price from public.products where id = v_product_id;
    if v_base_price is null then
      raise exception 'Order references a product that does not exist: %', v_product_id;
    end if;

    select discounted_price into v_promo_price
      from public.promotions
      where product_id = v_product_id
        and is_active = true
        and (start_date is null or start_date <= now())
        and (end_date is null or end_date >= now())
      order by discounted_price asc
      limit 1;

    -- An accepted haggle offer for THIS customer + product + unit is a
    -- legitimate, vendor-approved price — useCart.js applies it
    -- unconditionally once accepted, so it must win here too.
    select current_price into v_haggle_price
      from public.haggle_offers
      where product_id = v_product_id
        and customer_id = new.consumer_id
        and unit = (v_item->>'unit')
        and status = 'accepted'
      order by updated_at desc
      limit 1;

    v_valid_price := coalesce(v_haggle_price, v_promo_price, v_base_price);

    if v_claimed_price <> v_valid_price then
      raise exception 'Item price does not match the current listed price (product %, expected %, got %)',
        v_product_id, v_valid_price, v_claimed_price;
    end if;

    v_computed_subtotal := v_computed_subtotal + v_valid_price * v_claimed_qty;
  end loop;

  if new.subtotal <> v_computed_subtotal or new.total_amount <> v_computed_subtotal then
    raise exception 'Order total does not match item prices (expected %, got subtotal % / total %)',
      v_computed_subtotal, new.subtotal, new.total_amount;
  end if;

  return new;
end;
$$;

notify pgrst, 'reload schema';
