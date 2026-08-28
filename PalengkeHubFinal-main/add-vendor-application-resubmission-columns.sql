-- The admin "Request Resubmission" button only ever sent a notification —
-- there was no column tracking that a request was made, no vendor-facing
-- screen to actually re-upload documents, and no way for admin to tell a
-- resubmission had happened. This adds the state needed for all three.
--
-- resubmission_status: null (normal) | 'requested' (admin asked) | 'resubmitted' (applicant uploaded new docs)

alter table public.vendor_applications
  add column if not exists resubmission_status text,
  add column if not exists resubmission_message text,
  add column if not exists resubmission_requested_at timestamptz,
  add column if not exists resubmitted_at timestamptz;
