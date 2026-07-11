-- Soft-delete account lifecycle:
-- - keep auth.users row (so same email cannot be re-created for free credits)
-- - block future logins by banning the user
-- - keep a tombstone flag in user_credits
-- - remove app data payloads owned by the user

alter table public.user_credits
  add column if not exists soft_deleted boolean not null default false,
  add column if not exists soft_deleted_at timestamptz;

create or replace function public.is_account_soft_deleted()
returns boolean language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  deleted boolean;
begin
  if uid is null then
    return false;
  end if;

  select soft_deleted
    into deleted
    from public.user_credits
    where user_id = uid;

  return coalesce(deleted, false);
end $$;

revoke execute on function public.is_account_soft_deleted() from public;
grant execute on function public.is_account_soft_deleted() to authenticated;

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Remove user-generated content while preserving an anti-abuse tombstone.
  delete from public.conversations where user_id = uid;
  delete from public.credit_transactions where user_id = uid;

  insert into public.user_credits (
    user_id,
    balance,
    free_balance,
    free_period,
    legal_accepted,
    soft_deleted,
    soft_deleted_at,
    updated_at
  )
  values (
    uid,
    0,
    0,
    to_char(now(), 'YYYY-MM'),
    false,
    true,
    now(),
    now()
  )
  on conflict (user_id) do update
    set balance = 0,
        free_balance = 0,
        legal_accepted = false,
        soft_deleted = true,
        soft_deleted_at = now(),
        updated_at = now();

  update auth.users
    set banned_until = '9999-12-31 00:00:00+00'::timestamptz,
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) ||
          jsonb_build_object('softDeleted', true, 'softDeletedAt', now())
    where id = uid;
end $$;

revoke execute on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
