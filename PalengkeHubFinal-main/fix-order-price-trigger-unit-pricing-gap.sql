-- =====================================================
-- URGENT regression #2 — found while scoping the "size pricing for
-- fruits/vegetables" feature request, not through deliberate testing.
--
-- enforce_order_item_prices() only ever compared a checkout item's
-- price against the single products.price column. But this app has
-- had per-unit pricing all along: products.price_options is a
-- {unit: price} map a vendor can fill in (e.g. Chicken Breast #20 is
-- genuinely kg=200, 500g=150, 250g=56, piece=40), and
-- ProductDetailsScreen.js's UNIT_CONFIG has a multiplier per unit
-- (kg=1.00, 500g=0.50, 250g=0.25, piece=0.25, bundle=0.35,
-- dozen=2.40, pack=0.80) as the fallback price when a unit has no
-- explicit price_options entry.
--
-- My trigger knew none of this — it only ever checked the flat
-- products.price. Confirmed live: buying Chicken Breast #20 "per
-- piece" at its real, correct price of ₱40 was rejected with "Item
-- price does not match the current listed price (expected 200.00,
-- got 40)". Every non-default-unit purchase on every multi-unit
-- product has been broken since that trigger went live.
--
-- Also folded in: the client applies an active promotion's discount
-- FRESH against whichever unit's original price is showing
-- (ProductDetailsScreen.js's getDiscountedPrice — originalPrice * (1
-- - discount_value/100), or originalPrice - discount_value), not
-- against the flat promotions.discounted_price column my previous
-- version read (which is only ever generated relative to the
-- promotion's own original_price, implicitly the kg price). This
-- version recomputes it the same way the client does, per unit.
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
  v_unit text;
  v_claimed_price numeric;
  v_claimed_qty numeric;
  v_product record;
  v_unit_multiplier numeric;
  v_unit_original_price numeric;
  v_promo record;
  v_promo_price numeric;
  v_haggle_price numeric;
  v_valid_price numeric;
  v_computed_subtotal numeric := 0;
begin
  for v_item in select * from jsonb_array_elements(new.items)
  loop
    v_product_id := (v_item->>'id')::bigint;
    v_unit := coalesce(v_item->>'unit', 'kg');
    v_claimed_price := (v_item->>'price')::numeric;
    v_claimed_qty := (v_item->>'quantity')::numeric;

    select price, price_options into v_product
      from public.products where id = v_product_id;
    if v_product is null then
      raise exception 'Order references a product that does not exist: %', v_product_id;
    end if;

    -- Per-unit price: an explicit price_options[unit] entry wins;
    -- otherwise fall back to price * this unit's multiplier — same
    -- as ProductDetailsScreen.js's getUnitOriginalPrice().
    v_unit_multiplier := case v_unit
      when 'kg' then 1.00
      when '500g' then 0.50
      when '250g' then 0.25
      when 'piece' then 0.25
      when 'bundle' then 0.35
      when 'dozen' then 2.40
      when 'pack' then 0.80
      -- Size grades for produce (fruits/vegetables) that can't be cut to
      -- an exact weight — see AddProductModal.js's SIZE_UNIT_OPTIONS.
      -- Only a fallback for an unpriced size; a real listing always has
      -- its own price_options entry instead.
      when 'small' then 0.70
      when 'medium' then 1.00
      when 'large' then 1.40
      else 1.00
    end;

    if v_product.price_options ? v_unit then
      v_unit_original_price := (v_product.price_options ->> v_unit)::numeric;
    else
      v_unit_original_price := v_product.price * v_unit_multiplier;
    end if;

    -- Active promotion, applied fresh against THIS unit's price —
    -- matching getDiscountedPrice() exactly, not the flat
    -- promotions.discounted_price column (which is only ever
    -- relative to the promotion's own original_price).
    select discount_type, discount_value into v_promo
      from public.promotions
      where product_id = v_product_id
        and is_active = true
        and (start_date is null or start_date <= now())
        and (end_date is null or end_date >= now())
      limit 1;

    if v_promo is null then
      v_promo_price := v_unit_original_price;
    elsif v_promo.discount_type = 'percentage' then
      v_promo_price := v_unit_original_price * (1 - v_promo.discount_value / 100);
    else
      v_promo_price := greatest(0, v_unit_original_price - v_promo.discount_value);
    end if;

    -- An accepted haggle offer for THIS customer + product + unit
    -- overrides everything else — same as useCart.js.
    select current_price into v_haggle_price
      from public.haggle_offers
      where product_id = v_product_id
        and customer_id = new.consumer_id
        and unit = v_unit
        and status = 'accepted'
      order by updated_at desc
      limit 1;

    v_valid_price := coalesce(v_haggle_price, v_promo_price);

    if v_claimed_price <> v_valid_price then
      raise exception 'Item price does not match the current listed price (product %, unit %, expected %, got %)',
        v_product_id, v_unit, v_valid_price, v_claimed_price;
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
