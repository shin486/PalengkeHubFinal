-- =====================================================
-- Recreate the "Lancy" consumer account (aaronmanalo52105@gmail.com)
-- that was accidentally deleted while cleaning up unrelated seed-script
-- leftovers -- it had shown up 3 times (same name/email, different ids,
-- created seconds apart on 2026-08-05), which looks like a signup-flow
-- bug creating duplicates rather than 3 real accounts, so only ONE
-- account is recreated here.
--
-- What's NOT recoverable (wasn't captured before deletion, and isn't
-- known): the original password, phone number, and avatar_url. This
-- gives the account a dummy password ('PalengkeHub2026!', same as the
-- UAT seed script) and a blank phone -- update either from the app
-- (or another UPDATE statement) once you know the real values.
--
-- created_at is set to 2026-08-05 04:31:47+00, matching the earliest
-- of the 3 original duplicate rows, so it reads as the same original
-- registration moment rather than "just signed up today". Change the
-- timestamp literal below to now() if you'd rather it reflect today.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
--      (choose "Run without RLS" if the editor's warning dialog appears)
-- =====================================================

create extension if not exists pgcrypto;

with seed(full_name, email, phone, role, reg_at) as (
  values (
    'Lancy',
    'aaronmanalo52105@gmail.com',
    '',
    'consumer',
    timestamp '2026-08-05 04:31:47'
  )
),
ids as (
  select gen_random_uuid() as id, s.* from seed s
),
ins_auth as (
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin,
    confirmation_token, recovery_token,
    email_change_token_new, email_change, email_change_token_current
  )
  select
    id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    email,
    crypt('PalengkeHub2026!', gen_salt('bf')),
    reg_at,
    reg_at,
    reg_at,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', full_name, 'phone', phone, 'role', role),
    false,
    '', '', '', '', ''
  from ids
  returning id
),
ins_identities as (
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  )
  select
    gen_random_uuid(),
    ids.id,
    ids.email,
    jsonb_build_object('sub', ids.id::text, 'email', ids.email),
    'email',
    ids.reg_at,
    ids.reg_at,
    ids.reg_at
  from ids
  returning id
)
-- auth.users' on_auth_user_created trigger auto-creates the matching
-- public.profiles row (we don't have ALTER privileges to disable it,
-- and don't need to) -- this UPDATE just fixes created_at afterward,
-- since the trigger always stamps real now().
update public.profiles
set created_at = ids.reg_at,
    full_name = ids.full_name,
    phone = ids.phone,
    role = ids.role,
    is_active = true
from ids
where public.profiles.id = ids.id;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select id, email, full_name, phone, role, is_active, created_at
from public.profiles
where email = 'aaronmanalo52105@gmail.com';
