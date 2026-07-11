-- Legal consent persisted in DB: one boolean per user.
-- This is the source of truth for the app gate.

alter table public.user_credits
  add column if not exists legal_accepted boolean not null default false;

-- Backfill users that already accepted via auth metadata in older versions.
insert into public.user_credits (user_id, legal_accepted)
select u.id, true
from auth.users u
where coalesce(u.raw_user_meta_data ->> 'legalAcceptedAt', '') <> ''
on conflict (user_id) do update
  set legal_accepted = true;

-- Self-service write path under RLS: authenticated users can mark their own consent.
create or replace function public.accept_legal_consent()
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  insert into public.user_credits (user_id, legal_accepted, updated_at)
  values (uid, true, now())
  on conflict (user_id) do update
    set legal_accepted = true,
        updated_at = now();
end $$;

revoke execute on function public.accept_legal_consent() from public;
grant execute on function public.accept_legal_consent() to authenticated;
