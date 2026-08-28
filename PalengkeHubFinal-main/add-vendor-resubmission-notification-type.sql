-- notifications.type check constraint (see fix-notifications-type-constraint.sql)
-- was defined before the vendor-resubmission feature existed, so it rejects
-- the new 'vendor_resubmission' type used when admin asks an applicant to
-- resubmit documents. Same fix pattern: drop and recreate with the value
-- added, idempotent so it's safe to re-run.

alter table public.notifications drop constraint if exists notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'order',
    'order_update',
    'payment',
    'promotion',
    'announcement',
    'stall_location_reregister',
    'general',
    'vendor_resubmission'
  ));

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.notifications'::regclass
  and conname = 'notifications_type_check';
