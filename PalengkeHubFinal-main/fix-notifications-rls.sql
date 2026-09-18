-- ============================================================
-- PalengkeHub — Fix Notifications RLS Policy
-- Run this in your Supabase dashboard:
--   SQL Editor -> New query -> paste -> Run
-- ============================================================

-- Currently, public.notifications only allows users to insert rows
-- where auth.uid() = user_id (self-notifications).
-- When a vendor notifies a customer (status update, payment verification,
-- payment rejection, cancellation) or a customer notifies a vendor
-- (payment proof submitted), the insert is rejected by PostgreSQL with:
--   42501: new row violates row-level security policy for table "notifications" (403 Forbidden).

-- This policy allows any authenticated user (vendors, customers) to insert notifications.
-- Note: Each user can still only READ their own notifications (guarded by the existing SELECT policy: user_id = auth.uid()).

DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

CREATE POLICY "Authenticated users can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify current policies on public.notifications
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'notifications';

