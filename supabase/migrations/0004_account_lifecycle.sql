-- Account lifecycle helpers (GDPR): self-service account deletion.
-- Deleting auth.users cascades to conversations, user_credits and credit_transactions.

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
