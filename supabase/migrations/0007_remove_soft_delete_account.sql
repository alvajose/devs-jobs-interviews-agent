-- Revert soft-delete strategy back to hard-delete.
-- Reason: allow users to sign up again after deleting an account.

-- Clean up users previously soft-deleted so their emails can register again.
delete from auth.users u
using public.user_credits c
where c.user_id = u.id
  and c.soft_deleted = true;

drop function if exists public.is_account_soft_deleted();

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  delete from auth.users where id = uid;
end $$;

revoke execute on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
