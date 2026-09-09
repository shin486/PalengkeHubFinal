-- =====================================================
-- READ-ONLY diagnostic — no changes made. Run this and paste the
-- results back so the remaining tables (never captured in any
-- tracked SQL file in this repo, so presumably set up directly in
-- Supabase Studio) can actually be audited against what the app code
-- expects, instead of guessed at.
-- =====================================================

-- 1) RLS on/off + forced, for every table not yet confirmed this session
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'audit_log', 'complaints', 'contact_messages', 'conversations',
    'customer_reports', 'messages', 'notifications', 'price_history',
    'products', 'promotions', 'stall_locations'
  )
order by c.relname;

-- 2) Every policy currently on those tables
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where tablename in (
  'audit_log', 'complaints', 'contact_messages', 'conversations',
  'customer_reports', 'messages', 'notifications', 'price_history',
  'products', 'promotions', 'stall_locations'
)
order by tablename, cmd, policyname;

-- 3) Columns for the two least-familiar tables (conversations, complaints,
-- customer_reports) so their policies can be read against real column names
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('conversations', 'complaints', 'customer_reports', 'promotions')
order by table_name, ordinal_position;
