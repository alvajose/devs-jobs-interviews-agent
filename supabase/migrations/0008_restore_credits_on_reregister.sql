-- Preserve credits across account deletion/re-registration.
-- Behavior:
-- - Deleting an account still hard-deletes auth.users (all app data resets).
-- - Before delete, we snapshot the CURRENT available credits by email.
-- - If the same email signs up again, only those credits are restored (no new free grant).

create table if not exists public.deleted_account_credits (
  email text primary key,
  credits int not null default 0 check (credits >= 0),
  deleted_at timestamptz not null default now()
);

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
  user_email text;
  rec public.user_credits;
  cur_period text := to_char(now(), 'YYYY-MM');
  restore_total int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select email into user_email
    from auth.users
    where id = uid;

  select * into rec
    from public.user_credits
    where user_id = uid;

  if found then
    restore_total := greatest(
      0,
      rec.balance + case when rec.free_period <> cur_period
                         then public.monthly_free()
                         else rec.free_balance
                    end
    );
  end if;

  if user_email is not null and length(trim(user_email)) > 0 then
    insert into public.deleted_account_credits (email, credits, deleted_at)
    values (lower(trim(user_email)), restore_total, now())
    on conflict (email) do update
      set credits = excluded.credits,
          deleted_at = excluded.deleted_at;
  end if;

  delete from auth.users where id = uid;
end $$;

revoke execute on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;

create or replace function public.handle_new_user_credits()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  restored_credits int;
  normalized_email text := case
    when new.email is null then null
    else lower(trim(new.email))
  end;
begin
  if normalized_email is not null then
    select credits
      into restored_credits
      from public.deleted_account_credits
      where email = normalized_email;
  end if;

  if restored_credits is null then
    -- Brand-new email: default monthly free.
    insert into public.user_credits (user_id, balance, free_balance, free_period)
      values (new.id, 0, public.monthly_free(), to_char(now(), 'YYYY-MM'))
      on conflict (user_id) do nothing;
  else
    -- Re-registered email: restore exactly previous total as paid credits, no extra free grant.
    insert into public.user_credits (user_id, balance, free_balance, free_period)
      values (new.id, restored_credits, 0, to_char(now(), 'YYYY-MM'))
      on conflict (user_id) do nothing;

    if restored_credits > 0 then
      insert into public.credit_transactions (user_id, delta, reason)
        values (new.id, restored_credits, 'account-restore');
    end if;

    delete from public.deleted_account_credits
      where email = normalized_email;
  end if;

  return new;
end $$;
