-- The first migration's "parent reads teacher" policy selected from profiles
-- inside a profiles policy, which Postgres rejects as infinite recursion.
-- Run this once in the SQL editor. Do not re-run 0001_init.sql.

create or replace function is_parent()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'parent'
  );
$$;

revoke all on function public.is_parent() from public;
grant execute on function public.is_parent() to authenticated, service_role;

drop policy if exists "parent reads teacher" on profiles;
create policy "parent reads teacher" on profiles
  for select using (role = 'teacher' and is_parent());
