-- ============================================================
-- PalengkeHub — Payment verification SQL (Layer 7)
-- Run this in your Supabase dashboard:
--   SQL Editor -> New query -> paste -> Run
-- Safe to run more than once (uses IF NOT EXISTS).
-- ============================================================

-- 1) New columns for receipt scanning + duplicate-image detection.
--    The app already writes these fields; this just makes Supabase store them.
alter table public.orders
  add column if not exists payment_scan_text text,
  add column if not exists payment_scan_matched boolean default false,
  add column if not exists receipt_image_hash text;

-- 2) Block the SAME GCash reference number from being used on two different
--    orders that are (or reached) the verification stage. Rejected payments
--    are excluded so the customer can pay again with a fresh reference.
create unique index if not exists orders_payment_reference_unique
  on public.orders (payment_reference)
  where payment_reference is not null
    and payment_reference <> ''
    and payment_status in ('awaiting_verification', 'verified', 'paid');

-- ============================================================
-- OPTIONAL: rate-limit payment submissions per customer.
-- Uncomment and run to allow at most 10 submissions per hour per customer.
-- ============================================================
/*
create or replace function public.check_payment_rate()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.orders
    where consumer_id = new.consumer_id
      and updated_at > now() - interval '1 hour'
      and payment_status = 'awaiting_verification'
  ) >= 10 then
    raise exception 'Too many payment submissions. Please wait and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_payment_rate on public.orders;
create trigger trg_check_payment_rate
  before update of payment_status on public.orders
  for each row
  when (new.payment_status = 'awaiting_verification' and old.payment_status is distinct from 'awaiting_verification')
  execute function public.check_payment_rate();
*/
