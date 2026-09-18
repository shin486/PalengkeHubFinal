-- ====================================================================
-- PalengkeHub: Complete Cleanup of Orphan & Pre-August 4 Test Stalls
-- ====================================================================
-- Purpose:
--   Permanently purges the 18 orphaned and pre-August 4 test stalls 
--   (Stalls 1 to 17, and Stall 43) along with all dependent foreign keys
--   (orders, order_items, conversations, messages, ratings, promotions,
--   products, stall_locations, audit_log, etc.)
--
-- Protected UAT Stalls (Kept completely intact):
--   - Stall 68 (UAT-01, Ms. Abeth)
--   - Stall 69 (UAT-02, Ms. lulu)
--   - Stall 70 (UAT-03, Mr. Arman)
--   - Stall 71 (UAT-04, Mr. Arnel)
--   - Stall 72 (UAT-05, Maria Teresa "Tet" Castillo)
--   - Stall 73 (UAT-06, Roberto "Bert" Mendoza)
--   - Stall 74 (UAT-07, Elena "Nena" Recto)
--   - Stall 75 (UAT-08, Danilo "Danny" Katigbak)
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. Go to SQL Editor -> New Query
--   4. Paste this entire script -> Click "Run" (choose "Run without RLS")
-- ====================================================================

BEGIN;

-- 1. Identify target stall IDs for cleanup (all stalls with no vendor or created before August 4, excluding UAT stalls)
CREATE TEMPORARY TABLE IF NOT EXISTS target_stalls_to_purge (
  id bigint PRIMARY KEY
);
TRUNCATE target_stalls_to_purge;

INSERT INTO target_stalls_to_purge (id)
SELECT id FROM public.stalls
WHERE (
    vendor_id IS NULL 
    OR created_at < '2026-08-04 00:00:00+08'
    OR stall_name LIKE 'ZZZ_QA_%'
  )
  AND (stall_number NOT LIKE 'UAT-%' OR stall_number IS NULL)
  AND id NOT IN (68, 69, 70, 71, 72, 73, 74, 75, 27, 41);

-- 2. Delete messages and conversations attached to target stalls
DELETE FROM public.messages 
WHERE conversation_id IN (
  SELECT id FROM public.conversations 
  WHERE stall_id IN (SELECT id FROM target_stalls_to_purge)
);

DELETE FROM public.conversations 
WHERE stall_id IN (SELECT id FROM target_stalls_to_purge);

-- 3. Delete order items and orders referencing target stalls
DO $$
BEGIN
  IF to_regclass('public.order_items') IS NOT NULL THEN
    DELETE FROM public.order_items 
    WHERE order_id IN (
      SELECT id FROM public.orders 
      WHERE stall_id IN (SELECT id FROM target_stalls_to_purge)
    );
  END IF;
END $$;

DELETE FROM public.orders 
WHERE stall_id IN (SELECT id FROM target_stalls_to_purge);

-- 4. Delete ratings, promotions, and stall locations
DELETE FROM public.ratings 
WHERE stall_id IN (SELECT id FROM target_stalls_to_purge);

DELETE FROM public.promotions 
WHERE stall_id IN (SELECT id FROM target_stalls_to_purge);

DELETE FROM public.stall_locations 
WHERE stall_id IN (SELECT id FROM target_stalls_to_purge);

-- 5. Delete products belonging to target stalls
DELETE FROM public.products 
WHERE stall_id IN (SELECT id FROM target_stalls_to_purge);

-- 6. Clean up any remaining references in child tables dynamically
DO $$
DECLARE
  r RECORD;
BEGIN
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
      EXECUTE format('DELETE FROM %s WHERE %I IN (SELECT id FROM target_stalls_to_purge)', r.child_table, r.child_col);
    EXCEPTION WHEN OTHERS THEN
      -- Ignore if table does not exist or already clean
    END;
  END LOOP;
END $$;

-- 7. Delete the target stalls from public.stalls
DELETE FROM public.stalls 
WHERE id IN (SELECT id FROM target_stalls_to_purge);

COMMIT;

-- Verification: Check remaining stalls
SELECT id, stall_number, stall_name, section, is_active, vendor_id, created_at
FROM public.stalls
ORDER BY id ASC;
