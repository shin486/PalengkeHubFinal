-- =====================================================
-- Found during a follow-up "recheck everything for holes" pass, after
-- the haggle_offers and VendorPromotions fixes. Two real gaps on
-- `ratings`, confirmed live:
--
-- 1) A customer could submit a 5-star rating for an order that was
--    still just "pending" — never confirmed, never prepared, never
--    picked up. Reproduced live (inserted, then deleted the test
--    row). No server-side check ever required status = 'completed';
--    the app's UI just doesn't show a "Rate" button until then, which
--    a direct API call skips entirely.
--
-- 2) A customer could attach a real order's rating to a COMPLETELY
--    UNRELATED stall — pick any order they own, claim a different
--    stall_id in the insert, and it goes through. Reproduced live: a
--    1-star "review" landed on a stall this account never ordered
--    from. That's a working review-bombing vector against any stall
--    on the platform, using nothing but an order the attacker already
--    has. Also closed the same class of gap this session has now hit
--    three times (orders, stalls, haggle_offers): the owning vendor's
--    UPDATE isn't restricted to the vendor_reply fields, so nothing
--    stops a vendor from also editing the star rating / review text
--    on their own stall's ratings — closing that pre-emptively here
--    too, consistent with how those three were fixed.
--
-- Duplicate-rating spam is already blocked (there's an existing
-- ratings_order_id_fkey unique constraint) — not touched here.
-- SELECT stays fully public — stall reviews are meant to be visible
-- to any browsing customer (see StallReviewsScreen.js), that's
-- correct as-is.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

alter table public.ratings enable row level security;
alter table public.ratings force row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'ratings'
  loop
    execute format('drop policy if exists %I on public.ratings', pol.policyname);
  end loop;
end $$;

create policy "ratings_select_all"
  on public.ratings for select
  using (true);

create policy "ratings_insert_own"
  on public.ratings for insert
  with check (auth.uid() = consumer_id);

create policy "ratings_update_vendor_or_admin"
  on public.ratings for update
  using (
    public.is_admin()
    or exists (select 1 from public.stalls where id = ratings.stall_id and vendor_id = auth.uid())
  );

create policy "ratings_delete_vendor_or_admin"
  on public.ratings for delete
  using (
    public.is_admin()
    or exists (select 1 from public.stalls where id = ratings.stall_id and vendor_id = auth.uid())
  );

-- INSERT-time: the order must exist, belong to this customer, already
-- be completed, and its stall_id must match what's being claimed.
create or replace function public.enforce_rating_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order record;
begin
  select consumer_id, stall_id, status into v_order
  from public.orders where id = new.order_id;

  if v_order is null then
    raise exception 'Order not found';
  end if;

  if v_order.consumer_id <> new.consumer_id then
    raise exception 'You can only rate your own orders';
  end if;

  if v_order.stall_id <> new.stall_id then
    raise exception 'This order was not placed with that stall';
  end if;

  if v_order.status <> 'completed' then
    raise exception 'You can only rate a completed order';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_rating_rules on public.ratings;
create trigger trg_enforce_rating_rules
  before insert on public.ratings
  for each row
  execute function public.enforce_rating_rules();

-- UPDATE-time: the owning vendor may only touch their reply, never
-- the rating value, review text, or which order/stall/customer it's
-- attached to. Admin is unrestricted (moderation).
create or replace function public.enforce_rating_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.rating is distinct from old.rating
     or new.review is distinct from old.review
     or new.consumer_id is distinct from old.consumer_id
     or new.stall_id is distinct from old.stall_id
     or new.order_id is distinct from old.order_id
     or new.product_id is distinct from old.product_id then
    raise exception 'You can only reply to this rating, not change it';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_rating_update_rules on public.ratings;
create trigger trg_enforce_rating_update_rules
  before update on public.ratings
  for each row
  execute function public.enforce_rating_update_rules();

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select relname, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where relname = 'ratings' and relnamespace = 'public'::regnamespace;

select policyname, cmd
from pg_policies
where tablename = 'ratings'
order by cmd;

select trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_schema = 'public' and event_object_table = 'ratings';
