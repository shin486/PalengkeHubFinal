-- =====================================================
-- Correction to the previous version of this file. That version
-- added a new, restrictive UPDATE policy but only dropped a policy
-- by its own new name (a no-op, since that name didn't exist yet).
-- It DID fix the vendor's accept/decline/counter (confirmed live —
-- accept returned 200 and the offer's status flipped to 'accepted').
--
-- But the guard rail against a customer self-accepting their own
-- offer did NOT hold: a live retest had the customer PATCH their own
-- offer straight to status='accepted' and it succeeded (200), even
-- though the new policy's WITH CHECK should have blocked exactly
-- that. The only way that happens is if some OTHER, unnamed UPDATE
-- policy already existed on this table with no status restriction —
-- Postgres OR-combines every PERMISSIVE policy for the same command,
-- so my restriction was correct but irrelevant: the old, unrestricted
-- one covered the same customer_id=auth.uid() case and let it
-- through regardless. This is the exact same "stray policy survives
-- a name-specific drop" trap from the profiles fix earlier this
-- session — the fix is the same: drop EVERY existing policy on this
-- table unconditionally (not by guessing a name), then rebuild all
-- of select/insert/update/delete from scratch so nothing old is left
-- to silently override the new rule.
--
-- Rebuilt scope (matches what the app code actually does):
--   SELECT — the offer's own customer, own vendor, or admin (already
--     confirmed working before this fix; kept as-is).
--   INSERT — only the customer, and only for their own customer_id
--     (only ProductDetailsScreen.js ever inserts a new offer; the
--     vendor only ever UPDATEs an existing one).
--   UPDATE — vendor or admin: unrestricted (accept/decline/counter).
--     customer: allowed (counsel/withdraw), except status can never
--     become 'accepted' — that decision belongs to the vendor.
--   DELETE — admin only (nothing in the app deletes an offer).
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor → New query → paste this entire file → Run
-- =====================================================

alter table public.haggle_offers enable row level security;
alter table public.haggle_offers force row level security;

do $$
declare pol record;
begin
  for pol in select policyname from pg_policies where tablename = 'haggle_offers'
  loop
    execute format('drop policy if exists %I on public.haggle_offers', pol.policyname);
  end loop;
end $$;

create policy "haggle_offers_select_own_or_admin"
  on public.haggle_offers for select
  using (auth.uid() = customer_id or auth.uid() = vendor_id or public.is_admin());

create policy "haggle_offers_insert_own"
  on public.haggle_offers for insert
  with check (auth.uid() = customer_id);

create policy "haggle_offers_update_vendor_or_customer_or_admin"
  on public.haggle_offers for update
  using (auth.uid() = vendor_id or auth.uid() = customer_id or public.is_admin())
  with check (
    auth.uid() = vendor_id
    or public.is_admin()
    or (auth.uid() = customer_id and status <> 'accepted')
  );

create policy "haggle_offers_delete_admin"
  on public.haggle_offers for delete
  using (public.is_admin());

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select relname, relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class
where relname = 'haggle_offers' and relnamespace = 'public'::regnamespace;

select policyname, cmd
from pg_policies
where tablename = 'haggle_offers'
order by cmd;
