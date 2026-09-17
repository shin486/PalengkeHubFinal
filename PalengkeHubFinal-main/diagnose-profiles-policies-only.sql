-- Just the policy list on its own -- the SQL Editor only shows the
-- last statement's result when running several at once, so the
-- earlier diagnostic's most important query (this one) never showed.
select
  policyname,
  cmd,
  permissive,
  roles,
  qual as using_expression,
  with_check as with_check_expression
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by cmd, policyname;
