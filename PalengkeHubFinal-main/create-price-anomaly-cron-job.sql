-- =====================================================
-- Migration: daily price-anomaly check (reminders + deactivation)
--
-- Runs once a day, server-side, independent of anyone opening the
-- app: for every still-open price anomaly, sends a daily reminder;
-- for every one whose 3-day deadline has passed, deactivates that
-- vendor's whole stall (customers can no longer buy from them) and
-- records the deadline breach.
--
-- Depends on (run these first, in this order):
--   1. add-price-anomaly-notification-type.sql
--   2. create-price-anomalies-table.sql
--   3. add-stalls-deactivation-reason-column.sql
--
-- Requirements this migration needs from your Supabase project:
--   - The pg_cron and pg_net extensions must be enabled. This
--     migration tries to enable both itself; if either statement
--     errors, enable it manually first via Dashboard -> Database ->
--     Extensions, then re-run this file. pg_cron is not available on
--     every Supabase plan tier — if it's missing entirely, the daily
--     reminders and auto-deactivation won't run (the rest of the
--     feature — the warning dialog, admin review list, manual flag —
--     still works without this file).
--
-- The push-notification step (net.http_post to Expo) is
-- best-effort and wrapped in its own exception handler — a push
-- failure never blocks the actual state change (the in-app
-- notification row, and the deactivation itself, always happen).
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.run_price_anomaly_daily_check()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  r record;
  v_push_token text;
  v_title text;
  v_body text;
begin
  -- ── 1. Daily reminder for anomalies still pending, not yet due ──
  for r in
    select pa.*, p.name as product_name
    from public.price_anomalies pa
    join public.products p on p.id = pa.product_id
    where pa.status = 'pending'
      and pa.deadline > now()
      and (pa.last_warning_at is null or pa.last_warning_at < now() - interval '20 hours')
  loop
    v_title := 'Price still flagged';
    v_body := format(
      'Your price for %s is still flagged as a possible anomaly. Fix it before %s or your stall will be deactivated.',
      r.product_name, to_char(r.deadline, 'Mon DD, HH12:MI AM')
    );

    insert into public.notifications (user_id, title, message, type, data, is_read, created_at)
    values (
      r.vendor_id, v_title, v_body, 'price_anomaly',
      jsonb_build_object('anomaly_id', r.id, 'product_id', r.product_id, 'stage', 'daily_warning'),
      false, now()
    );

    select expo_push_token into v_push_token from public.profiles where id = r.vendor_id;
    if v_push_token is not null then
      begin
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'to', v_push_token, 'sound', 'default', 'title', v_title, 'body', v_body,
            'data', jsonb_build_object('type', 'price_anomaly', 'anomaly_id', r.id)
          )
        );
      exception when others then
        null; -- best-effort; the notifications row above already landed
      end;
    end if;

    update public.price_anomalies set last_warning_at = now() where id = r.id;
  end loop;

  -- ── 2. Deactivate stalls whose deadline has passed ──
  for r in
    select pa.*, p.name as product_name
    from public.price_anomalies pa
    join public.products p on p.id = pa.product_id
    where pa.status = 'pending'
      and pa.deadline <= now()
  loop
    update public.price_anomalies set status = 'deactivated' where id = r.id;

    update public.stalls
      set is_active = false, deactivation_reason = 'price_anomaly'
      where id = r.stall_id and is_active = true;

    v_title := 'Stall deactivated';
    v_body := format(
      'Your stall was deactivated because the price for %s was never corrected within 3 days. Fix the price and message admin to get reactivated.',
      r.product_name
    );

    insert into public.notifications (user_id, title, message, type, data, is_read, created_at)
    values (
      r.vendor_id, v_title, v_body, 'price_anomaly',
      jsonb_build_object('anomaly_id', r.id, 'product_id', r.product_id, 'stage', 'deactivated'),
      false, now()
    );

    select expo_push_token into v_push_token from public.profiles where id = r.vendor_id;
    if v_push_token is not null then
      begin
        perform net.http_post(
          url := 'https://exp.host/--/api/v2/push/send',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object(
            'to', v_push_token, 'sound', 'default', 'title', v_title, 'body', v_body,
            'data', jsonb_build_object('type', 'price_anomaly', 'anomaly_id', r.id)
          )
        );
      exception when others then
        null;
      end;
    end if;
  end loop;
end;
$$;

-- Re-runnable: drop any existing schedule under this name before
-- creating it fresh, rather than relying on cron.schedule's upsert
-- behavior (which varies by pg_cron version).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'price-anomaly-daily-check') then
    perform cron.unschedule('price-anomaly-daily-check');
  end if;
end $$;

-- 1:00 UTC = 9:00 AM Philippine Time (UTC+8). Adjust the first
-- argument (standard cron syntax: minute hour day month weekday) if
-- you want a different local time.
select cron.schedule(
  'price-anomaly-daily-check',
  '0 1 * * *',
  $$select public.run_price_anomaly_daily_check();$$
);

-- ── Verify ───────────────────────────────────────────────
select jobid, jobname, schedule, active from cron.job where jobname = 'price-anomaly-daily-check';
