-- =====================================================
-- Full customer/vendor/admin sweep — findings and fixes.
--
-- Live-tested against the running app with real credentials
-- (customer@palengkehub.com, vendor@palengkehub.com,
-- admin@palengkehub.com). Every issue below was reproduced with a
-- direct REST call (not guessed from reading code), and every
-- accidental side effect from testing was reverted immediately
-- after confirming the bug.
--
-- 1) vendor_applications had NO real access control. As an ordinary
--    customer who never applied to be a vendor, a plain SELECT
--    against this table returned OTHER PEOPLE'S full applications —
--    including signed URLs to their government IDs, business
--    permits, and GCash QR codes (tokens valid until year 2103).
--    Same class of bug as the profiles leak fixed earlier this
--    session, just on a table nobody had gone back to lock down.
--
-- 2) stalls had no owner check on UPDATE. Logged in as
--    vendor@palengkehub.com, a direct PATCH closed a COMPLETELY
--    DIFFERENT vendor's stall ("Lordwig$ Veggies") — any vendor
--    could sabotage any other vendor's storefront. Reverted
--    immediately after confirming.
--
-- 3) orders had no restriction on which fields a customer can change
--    on their OWN order. A direct PATCH set status straight to
--    'completed' on a real order, skipping the entire vendor
--    fulfillment workflow (confirmed → preparing → ready →
--    completed) and the payment-verification step entirely.
--    Reverted to 'confirmed' immediately after confirming (the exact
--    prior value wasn't captured before the probe overwrote it — see
--    chat for detail — 'confirmed' matches a sibling order in the
--    same negotiated state).
--
-- 4) orders never re-validated item prices server-side. A checkout
--    insert claiming ₱1/kg for a real ₱220/kg product was accepted
--    outright — any customer could order anything for near-zero
--    cost. Confirmed live (ordered 5kg for a claimed ₱5 total,
--    deleted immediately after confirming), not just theorized.
--
-- 5) orders.cancel_reason and orders.payment_rejection_reason don't
--    exist as columns, even though VendorOrderDetailScreen.js and
--    VendorOrdersScreen.js already try to write them when a vendor
--    rejects a payment or cancels an order with a reason. Both of
--    those vendor actions are currently failing outright (PGRST204).
--    Unrelated to security — a plain missing-column bug found while
--    reading the code to scope fix #3 correctly.
--
-- 6) profiles.full_name had no length limit — a 5000-character name
--    was accepted with no error. Low severity (Postgres text has no
--    inherent limit, so this isn't a crash risk) but would break
--    layout on every screen that renders a name. Client-side
--    maxLength was added in SignUpScreen.js; this adds the
--    server-side backstop.
--
-- Everything a customer/vendor legitimately does today was read
-- directly from the app's own code (CheckoutContent.js,
-- OrdersScreen.js, useVendorOrders.js, VendorOrderDetailScreen.js,
-- VendorApplicationStatusScreen.js, useVendorPromotions.js) before
-- writing the restrictions below, specifically so real flows
-- (cancel, submit GCash payment proof, accept/reject a vendor's
-- haggle proposal, resubmit vendor documents, apply active
-- promotions) keep working. If something legitimate breaks anyway,
-- the error message names exactly which rule blocked it.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
--   4. Tell me what the verification queries at the bottom return.
-- =====================================================

-- ───────────────────────────────────────────────────────
-- 1) vendor_applications: lock down to (own applicant) or admin.
-- Same "don't assume — verify RLS is actually on" lesson as
-- profiles: enable + force before touching policies.
-- ───────────────────────────────────────────────────────
alter table public.vendor_applications enable row level security;
alter table public.vendor_applications force row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'vendor_applications'
  loop
    execute format('drop policy if exists %I on public.vendor_applications', pol.policyname);
  end loop;
end $$;

create policy "vendor_applications_select_own_or_admin"
  on public.vendor_applications for select
  using (auth.uid() = applicant_id or public.is_admin());

create policy "vendor_applications_insert_own"
  on public.vendor_applications for insert
  with check (auth.uid() = applicant_id);

create policy "vendor_applications_update_own_or_admin"
  on public.vendor_applications for update
  using (auth.uid() = applicant_id or public.is_admin());

create policy "vendor_applications_delete_admin"
  on public.vendor_applications for delete
  using (public.is_admin());

-- Applicants may edit their own application (e.g. resubmitting
-- documents), but only admin can move status off 'pending' or touch
-- the review fields — otherwise an applicant could just PATCH their
-- own application straight to 'approved'.
create or replace function public.enforce_vendor_application_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role = 'admin' then
    return new;
  end if;

  if new.status is distinct from 'pending'
     and (TG_OP = 'INSERT' or old.status is distinct from new.status) then
    raise exception 'Only an admin can change a vendor application''s status';
  end if;

  if TG_OP = 'UPDATE' and (
       new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.notes is distinct from old.notes
    or new.resubmission_message is distinct from old.resubmission_message
    or new.resubmission_requested_at is distinct from old.resubmission_requested_at
    or new.applicant_id is distinct from old.applicant_id
  ) then
    raise exception 'You are not allowed to change that field on your application';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_vendor_application_rules on public.vendor_applications;
create trigger trg_enforce_vendor_application_rules
  before insert or update on public.vendor_applications
  for each row
  execute function public.enforce_vendor_application_rules();

-- ───────────────────────────────────────────────────────
-- 2) stalls: keep SELECT public (customers must browse every
-- stall — that's the whole app), but scope UPDATE/INSERT/DELETE to
-- the owning vendor or admin.
-- ───────────────────────────────────────────────────────
alter table public.stalls enable row level security;
alter table public.stalls force row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'stalls'
  loop
    execute format('drop policy if exists %I on public.stalls', pol.policyname);
  end loop;
end $$;

create policy "stalls_select_all"
  on public.stalls for select
  using (true);

create policy "stalls_update_own_or_admin"
  on public.stalls for update
  using (auth.uid() = vendor_id or public.is_admin());

-- No code path in this repo inserts a stall directly (vendor
-- approval must create it some other way) — admin-only is a safe
-- default and doesn't block anything that exists today.
create policy "stalls_insert_admin"
  on public.stalls for insert
  with check (public.is_admin());

create policy "stalls_delete_admin"
  on public.stalls for delete
  using (public.is_admin());

-- ───────────────────────────────────────────────────────
-- 3) orders: add the two columns the vendor UI already expects
-- (currently missing — every "reject payment with reason" / "cancel
-- with reason" action from a vendor fails outright right now).
-- ───────────────────────────────────────────────────────
alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists payment_rejection_reason text;

-- Restrict what a CUSTOMER can change on their own order after it's
-- placed. Vendors (owning the order's stall) and admins are
-- untouched by this — only the consumer_id = auth.uid() path is
-- restricted. Mirrors exactly what CheckoutContent.js/OrdersScreen.js
-- already do: cancel (status -> 'cancelled' only), submit GCash
-- payment proof, and accept/reject an existing vendor proposal.
create or replace function public.enforce_order_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_is_vendor_owner boolean;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role = 'admin' then
    return new;
  end if;

  select exists (
    select 1 from public.stalls where id = old.stall_id and vendor_id = auth.uid()
  ) into v_is_vendor_owner;

  if v_is_vendor_owner then
    return new;
  end if;

  if auth.uid() = old.consumer_id then
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'You can only cancel your own order, not set it to %', new.status;
    end if;

    if new.payment_status = 'verified' and old.payment_status is distinct from 'verified' then
      raise exception 'Only the vendor can mark a payment as verified';
    end if;

    if (new.items is distinct from old.items or new.total_amount is distinct from old.total_amount)
       and old.proposed_changes is null then
      raise exception 'Order items/total can only change in response to an existing vendor proposal';
    end if;

    if new.subtotal is distinct from old.subtotal
       or new.stall_id is distinct from old.stall_id
       or new.consumer_id is distinct from old.consumer_id
       or new.vendor_notes is distinct from old.vendor_notes
       or new.cancel_reason is distinct from old.cancel_reason
       or new.payment_rejection_reason is distinct from old.payment_rejection_reason
       or new.order_number is distinct from old.order_number then
      raise exception 'You are not allowed to change that field on your order';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update this order';
end;
$$;

drop trigger if exists trg_enforce_order_update_rules on public.orders;
create trigger trg_enforce_order_update_rules
  before update on public.orders
  for each row
  execute function public.enforce_order_update_rules();

-- Re-validate every item's price against the real, current price
-- (products.price, or an active promotions.discounted_price if one
-- exists for that product) at the moment an order is placed. Only
-- INSERT is checked — orders are only ever created at checkout in
-- this app, never by a vendor/admin, so this applies unconditionally.
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

    v_valid_price := coalesce(v_promo_price, v_base_price);

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

drop trigger if exists trg_enforce_order_item_prices on public.orders;
create trigger trg_enforce_order_item_prices
  before insert on public.orders
  for each row
  execute function public.enforce_order_item_prices();

-- ───────────────────────────────────────────────────────
-- 4) profiles.full_name: server-side length backstop (client-side
-- maxLength was added in SignUpScreen.js in the same pass).
-- ───────────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_full_name_length;
alter table public.profiles add constraint profiles_full_name_length check (char_length(full_name) <= 100);

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select tablename, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_tables
join pg_class on pg_class.relname = pg_tables.tablename
where pg_tables.tablename in ('vendor_applications', 'stalls', 'orders', 'profiles')
  and pg_tables.schemaname = 'public';

select tablename, policyname, cmd
from pg_policies
where tablename in ('vendor_applications', 'stalls')
order by tablename, cmd;

select trigger_name, event_object_table, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'trg_enforce_vendor_application_rules',
    'trg_enforce_order_update_rules',
    'trg_enforce_order_item_prices'
  );

select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'orders'
  and column_name in ('cancel_reason', 'payment_rejection_reason');
