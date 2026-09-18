-- ====================================================================
-- PalengkeHub: Cleanup Test Accounts Registered Before August 4, 2026
-- ====================================================================
-- Purpose:
--   Removes early test/developer accounts created before August 4, 2026,
--   leaving only the real UAT respondent data (20 consumers, 8 vendors,
--   2 admins) registered on August 5–6, 2026.
--
-- Protected UAT Vendors:
--   - Ms. lulu (LuLu Fruits Stall, UAT-02)
--   - Ms. Abeth (Abeth, UAT-01)
--   - Maria Teresa "Tet" Castillo (Aling Tet's Meat Shop, UAT-05)
--   - Elena "Nena" Recto (Nena's Fresh Gulayan, UAT-07)
--   - Roberto "Bert" Mendoza (Mang Bert's Seafood Section, UAT-06)
--   - Mr. Arnel (Arnel's Meat Shop, UAT-04)
--   - Mr. Arman (Nanay Puring Vegetable Stall, UAT-03)
--   - Danilo "Danny" Katigbak (Katigbak Wet Store, UAT-08)
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. Go to SQL Editor -> New Query
--   4. Paste this entire file -> Click "Run" (If prompted by modal, choose "Run without RLS")
-- ====================================================================

-- ── STEP 1: PREVIEW ACCOUNTS TO BE DELETED (DRY RUN) ────────────────
-- Run just this query if you want to inspect the accounts before deleting:
/*
SELECT 
  id,
  email,
  full_name,
  role,
  created_at
FROM public.profiles
WHERE created_at < '2026-08-04 00:00:00+08'
  AND role != 'admin'
  AND email NOT IN (
    'lulu_fruits2020@gmail.com',
    'abethrice05@gmail.com',
    'tetcastillo82@gmail.com',
    'nenarecto1975@gmail.com',
    'mendoza_bert07@gmail.com',
    'kuyaarnel19@gmail.com',
    'armanveggie23@gmail.com',
    'dkatigbak90@gmail.com'
  )
ORDER BY created_at ASC;
*/

-- ── STEP 2: TRANSACTIONAL CLEANUP ──────────────────────────────────
BEGIN;

-- 1. Create temporary table of target user IDs to be removed
CREATE TEMPORARY TABLE IF NOT EXISTS target_users_to_delete (
  id uuid PRIMARY KEY,
  email text,
  created_at timestamptz
);
TRUNCATE target_users_to_delete;

INSERT INTO target_users_to_delete (id, email, created_at)
SELECT id, email, created_at
FROM auth.users
WHERE created_at < '2026-08-04 00:00:00+08'
  AND email NOT IN (
    'lulu_fruits2020@gmail.com',
    'abethrice05@gmail.com',
    'tetcastillo82@gmail.com',
    'nenarecto1975@gmail.com',
    'mendoza_bert07@gmail.com',
    'kuyaarnel19@gmail.com',
    'armanveggie23@gmail.com',
    'dkatigbak90@gmail.com'
  )
  AND id NOT IN (
    SELECT id FROM public.profiles WHERE role = 'admin'
  );

-- Also capture any profiles with created_at < August 4 that might not be in auth.users
INSERT INTO target_users_to_delete (id, email, created_at)
SELECT id, email, created_at
FROM public.profiles
WHERE created_at < '2026-08-04 00:00:00+08'
  AND role != 'admin'
  AND email NOT IN (
    'lulu_fruits2020@gmail.com',
    'abethrice05@gmail.com',
    'tetcastillo82@gmail.com',
    'nenarecto1975@gmail.com',
    'mendoza_bert07@gmail.com',
    'kuyaarnel19@gmail.com',
    'armanveggie23@gmail.com',
    'dkatigbak90@gmail.com'
  )
  AND id NOT IN (SELECT id FROM target_users_to_delete);

-- 2. Identify stalls owned by test accounts (exclude all UAT stalls and protected vendors)
CREATE TEMPORARY TABLE IF NOT EXISTS target_stalls_to_delete (
  id bigint PRIMARY KEY,
  vendor_id uuid,
  stall_name text,
  stall_number text
);
TRUNCATE target_stalls_to_delete;

INSERT INTO target_stalls_to_delete (id, vendor_id, stall_name, stall_number)
SELECT id, vendor_id, stall_name, stall_number
FROM public.stalls
WHERE (
    vendor_id IN (SELECT id FROM target_users_to_delete)
    OR created_at < '2026-08-04 00:00:00+08'
  )
  AND (stall_number NOT LIKE 'UAT-%' OR stall_number IS NULL)
  AND (
    vendor_id IS NULL OR vendor_id NOT IN (
      SELECT id FROM public.profiles 
      WHERE email IN (
        'lulu_fruits2020@gmail.com',
        'abethrice05@gmail.com',
        'tetcastillo82@gmail.com',
        'nenarecto1975@gmail.com',
        'mendoza_bert07@gmail.com',
        'kuyaarnel19@gmail.com',
        'armanveggie23@gmail.com',
        'dkatigbak90@gmail.com'
      )
    )
  );

-- Show count of accounts and stalls being targeted
DO $$
DECLARE
  v_user_count INT;
  v_stall_count INT;
BEGIN
  SELECT count(*) INTO v_user_count FROM target_users_to_delete;
  SELECT count(*) INTO v_stall_count FROM target_stalls_to_delete;
  RAISE NOTICE 'Targeting % test user account(s) and % test stall(s) registered before August 4, 2026 for cleanup.', v_user_count, v_stall_count;
END $$;

-- ── STEP 3: DYNAMIC SAFE DELETION (NO COLUMN-DOES-NOT-EXIST ERRORS) ──
DO $$
DECLARE
  v_tbl text;
  v_col text;
  v_sql text;
  v_conds text[];
  v_user_cols text[] := ARRAY[
    'user_id', 'vendor_id', 'customer_id', 'consumer_id', 
    'sender_id', 'applicant_id', 'flagged_by', 'captured_by', 'verified_by_admin'
  ];
  v_stall_cols text[] := ARRAY['stall_id'];
  v_tables text[] := ARRAY[
    'cart_items',
    'carts',
    'favorites',
    'notifications',
    'haggle_offers',
    'customer_reports',
    'vendor_reports',
    'price_anomalies',
    'price_history',
    'ratings',
    'stall_reviews',
    'reviews',
    'audit_log',
    'audit_logs',
    'violations',
    'order_items',
    'orders',
    'promotions',
    'products',
    'stall_locations',
    'vendor_applications'
  ];
  r RECORD;
BEGIN
  -- A. Clean chat messages that reference conversations belonging to target users or target stalls
  IF to_regclass('public.messages') IS NOT NULL AND to_regclass('public.conversations') IS NOT NULL THEN
    BEGIN
      DELETE FROM public.messages 
      WHERE conversation_id IN (
        SELECT id FROM public.conversations 
        WHERE customer_id IN (SELECT id FROM target_users_to_delete)
           OR stall_id IN (SELECT id FROM target_stalls_to_delete)
      );
    EXCEPTION WHEN OTHERS THEN
      -- Proceed gracefully if column structure differs
    END;
  END IF;

  -- B. Dynamically delete from dependent child tables only by columns that ACTUALLY exist
  FOREACH v_tbl IN ARRAY v_tables LOOP
    IF to_regclass('public.' || quote_ident(v_tbl)) IS NOT NULL THEN
      v_conds := ARRAY[]::text[];

      -- Check and match user-identifying columns
      FOREACH v_col IN ARRAY v_user_cols LOOP
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = v_col
        ) THEN
          v_conds := array_append(v_conds, quote_ident(v_col) || ' IN (SELECT id FROM target_users_to_delete)');
        END IF;
      END LOOP;

      -- Check and match stall-identifying columns
      FOREACH v_col IN ARRAY v_stall_cols LOOP
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = v_col
        ) THEN
          v_conds := array_append(v_conds, quote_ident(v_col) || ' IN (SELECT id FROM target_stalls_to_delete)');
        END IF;
      END LOOP;

      -- If any matching column was found on this table, execute dynamic deletion
      IF array_length(v_conds, 1) > 0 THEN
        v_sql := 'DELETE FROM public.' || quote_ident(v_tbl) || ' WHERE ' || array_to_string(v_conds, ' OR ');
        EXECUTE v_sql;
      END IF;
    END IF;
  END LOOP;

  -- C. Clean up chat / conversation heads
  IF to_regclass('public.conversations') IS NOT NULL THEN
    BEGIN
      DELETE FROM public.conversations 
      WHERE customer_id IN (SELECT id FROM target_users_to_delete)
         OR stall_id IN (SELECT id FROM target_stalls_to_delete);
    EXCEPTION WHEN OTHERS THEN
      -- Proceed gracefully
    END;
  END IF;

  IF to_regclass('public.chats') IS NOT NULL THEN
    BEGIN
      DELETE FROM public.chats 
      WHERE customer_id IN (SELECT id FROM target_users_to_delete)
         OR vendor_id IN (SELECT id FROM target_users_to_delete);
    EXCEPTION WHEN OTHERS THEN
      -- Proceed gracefully
    END;
  END IF;

  -- D. Dynamically scan pg_constraint for ANY remaining foreign key pointing to stalls
  FOR r IN (
    SELECT 
      c.conrelid::regclass::text AS child_table,
      a.attname AS child_col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.stalls'::regclass
      AND c.conrelid != 'public.stalls'::regclass
  ) LOOP
    BEGIN
      EXECUTE format('DELETE FROM %s WHERE %I IN (SELECT id FROM target_stalls_to_delete)', r.child_table, r.child_col);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if rows already deleted
    END;
  END LOOP;

  -- E. Dynamically scan pg_constraint for ANY remaining foreign key pointing to profiles or auth.users
  FOR r IN (
    SELECT 
      c.conrelid::regclass::text AS child_table,
      a.attname AS child_col
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid IN ('public.profiles'::regclass, 'auth.users'::regclass)
      AND c.conrelid NOT IN ('public.profiles'::regclass, 'auth.users'::regclass)
  ) LOOP
    BEGIN
      EXECUTE format('DELETE FROM %s WHERE %I IN (SELECT id FROM target_users_to_delete)', r.child_table, r.child_col);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if rows already deleted
    END;
  END LOOP;

  -- F. Delete target stalls
  DELETE FROM public.stalls WHERE id IN (SELECT id FROM target_stalls_to_delete);

  -- G. Delete target user profiles
  DELETE FROM public.profiles WHERE id IN (SELECT id FROM target_users_to_delete);

  -- H. Delete root authentication users
  DELETE FROM auth.users WHERE id IN (SELECT id FROM target_users_to_delete);

END $$;

COMMIT;

-- ── STEP 4: VERIFY REMAINING DATA ──────────────────────────────────
-- Confirm summary of remaining accounts:
SELECT 
  role,
  count(*) AS total_accounts,
  min(created_at) AS earliest_registration,
  max(created_at) AS latest_registration
FROM public.profiles
GROUP BY role
ORDER BY role;

-- List remaining registered vendors with stalls and coordinates:
SELECT 
  p.full_name AS vendor_name,
  p.email,
  s.stall_name,
  s.stall_number,
  s.section,
  s.is_active,
  sl.lat,
  sl.lng
FROM public.profiles p
JOIN public.stalls s ON s.vendor_id = p.id
LEFT JOIN public.stall_locations sl ON sl.stall_id = s.id AND sl.is_current = true
WHERE p.role = 'vendor'
ORDER BY s.stall_number ASC;

-- Clean up temporary tables
DROP TABLE IF EXISTS target_users_to_delete;
DROP TABLE IF EXISTS target_stalls_to_delete;
