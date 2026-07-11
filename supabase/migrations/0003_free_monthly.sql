-- Free monthly allotment. Adds a resettable "free" bucket alongside the never-expiring paid
-- balance. Additive + idempotent: run 0002 first, then this. Re-running is safe.
--
-- Two buckets, one row:
--   balance       = PAID credits (from Stripe). Never expire.
--   free_balance  = this month's FREE credits. Reset monthly, use-it-or-lose-it.
-- Spending takes from free FIRST, then paid, so purchased credits last as long as possible.
-- The monthly reset is lazy (computed on read/spend); no cron needed.

-- The only knob: how many free credits per month. Change this one function.
create or replace function public.monthly_free() returns int
  language sql immutable as $$ select 30 $$;

alter table public.user_credits
  add column if not exists free_balance int  not null default 0,
  add column if not exists free_period  text not null default to_char(now(), 'YYYY-MM');

-- Effective available = paid + this month's free (recomputed if the stored period is stale).
-- Read-only: the actual reset is persisted on the next spend.
create or replace function public.available_credits()
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rec public.user_credits;
  eff_free int;
begin
  if uid is null then return 0; end if;
  select * into rec from public.user_credits where user_id = uid;
  if not found then return 0; end if;
  eff_free := case when rec.free_period <> to_char(now(), 'YYYY-MM')
                   then public.monthly_free() else rec.free_balance end;
  return eff_free + rec.balance;
end $$;

-- Spend: lazily reset the free bucket at month rollover, then spend FREE first, PAID second.
create or replace function public.spend_credits(p_amount int, p_reason text default 'llm')
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur_period text := to_char(now(), 'YYYY-MM');
  rec public.user_credits;
  free_now int;
  from_free int;
  from_paid int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select * into rec from public.user_credits where user_id = uid for update;
  if not found then
    insert into public.user_credits (user_id, balance, free_balance, free_period)
      values (uid, 0, public.monthly_free(), cur_period)
      returning * into rec;
  end if;

  -- Fresh month => free bucket is back at full, regardless of what's stored.
  free_now  := case when rec.free_period <> cur_period
                    then public.monthly_free() else rec.free_balance end;
  from_free := least(free_now, p_amount);
  from_paid := p_amount - from_free;

  update public.user_credits
    set free_balance = free_now - from_free,
        free_period  = cur_period,
        balance      = balance - from_paid,
        updated_at   = now()
    where user_id = uid;

  insert into public.credit_transactions (user_id, delta, reason)
    values (uid, -p_amount, p_reason);

  return (free_now - from_free) + (rec.balance - from_paid);
end $$;

-- New users start with the free bucket seeded, no paid bonus (the monthly free IS the free tier).
create or replace function public.handle_new_user_credits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_credits (user_id, balance, free_balance, free_period)
    values (new.id, 0, public.monthly_free(), to_char(now(), 'YYYY-MM'))
    on conflict (user_id) do nothing;
  return new;
end $$;

-- Backfill existing rows so they have this month's free bucket now.
update public.user_credits
  set free_balance = public.monthly_free(), free_period = to_char(now(), 'YYYY-MM');

-- Security: grant_credits mints credits, so only the server (service_role) may call it, never
-- an end user from the client. Without this revoke, any signed-in user could self-grant credits.
revoke execute on function public.grant_credits(uuid, int, text) from public;
grant  execute on function public.grant_credits(uuid, int, text) to service_role;
