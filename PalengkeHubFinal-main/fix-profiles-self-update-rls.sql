-- =====================================================
-- Root cause of "I favorite something, it shows, then disappears a
-- few seconds later": profiles has NO update policy at all for a user
-- updating their own row. Confirmed directly -- calling the exact
-- upsert useFavorites.js's saveFavorites() makes returns:
--
--   403 { "code": "42501", "message": "new row violates row-level
--   security policy for table \"profiles\"" }
--
-- toggleProductFavorite() optimistically updates local React state
-- first (so the heart fills in immediately -- that's the "shows" part),
-- then fires the Supabase upsert in the background. That upsert has
-- always been silently failing (caught, only console.warn'd, so
-- nothing on screen ever indicated it). The moment ANYTHING re-fetches
-- from the server -- reopening the Favorites screen, revisiting
-- Profile, a plain reload -- it reads the untouched database and the
-- favorite reverts. This isn't unique to favorites: ANY self-service
-- profile update (changing your own name/phone/avatar) has been
-- silently failing the same way.
--
-- Fix: add the missing "update your own row" policy, paired with a
-- trigger that blocks a self-update from touching the fields a user
-- should never be able to grant themselves (role, is_active,
-- compliance_score, compliance_warnings) -- same pattern already used
-- elsewhere in this project (enforce_vendor_application_rules(),
-- enforce_order_update_rules(), etc: RLS allows the row-level write,
-- a trigger enforces which fields may actually change).
--
-- An admin updating a DIFFERENT user's row (auth.uid() <> that row's
-- id) is unaffected by the trigger below -- it only blocks a user
-- editing their OWN row from touching those fields, not an admin
-- editing someone else's.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

-- Diagnostic: current policies on profiles, so you can see exactly
-- what's there before this adds to it. Purely informational.
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'profiles';

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.enforce_profile_self_update_rules()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Only restricts a user editing THEIR OWN row -- an admin (or any
  -- other actor) updating someone else's row has a different auth.uid()
  -- than OLD.id, so this condition is false and the update proceeds.
  if auth.uid() = old.id then
    if new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.compliance_score is distinct from old.compliance_score
      or new.compliance_warnings is distinct from old.compliance_warnings
    then
      raise exception 'Cannot self-modify role, active status, or compliance fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_self_update_rules on public.profiles;
create trigger trg_enforce_profile_self_update_rules
  before update on public.profiles
  for each row execute function public.enforce_profile_self_update_rules();

-- ── Verify ───────────────────────────────────────────────
-- Re-run the exact failing call as yourself (replace the id with your
-- own auth.uid() if testing as a different user) -- should now succeed:
-- update public.profiles set favorites = favorites where id = auth.uid();
select policyname, cmd from pg_policies
where schemaname = 'public' and tablename = 'profiles' and cmd = 'UPDATE';
