-- Daily free credits (replaces the monthly reset). Stripe/paid credits are disabled for now
-- (no merchant setup yet), so the free bucket is the whole economy while we're in testing:
--   - each active day tops the free bucket up by daily_free()
--   - never exceeding free_cap() (unused credits carry over up to the cap)
-- Lazy like before: the top-up is computed on read/spend, no cron. Run after 0009.
--
-- When Stripe comes back, the paid `balance` bucket already works alongside this untouched.

-- Knobs: daily allowance and the ceiling it can accumulate to.
create or replace function public.daily_free() returns int
  language sql immutable as $$ select 25 $$;
create or replace function public.free_cap() returns int
  language sql immutable as $$ select 50 $$;

-- Single source of truth for the refresh: on a new day, add daily_free() capped at free_cap();
-- otherwise keep the stored balance. (rec is passed in, so this stays immutable.)
create or replace function public.effective_free(rec public.user_credits, cur_period text)
returns int language sql immutable as $$
  select case when rec.free_period <> cur_period
              then least(public.free_cap(), rec.free_balance + public.daily_free())
              else rec.free_balance end
$$;

-- Effective available = paid + effective free.
create or replace function public._available_from_row(rec public.user_credits, cur_period text)
returns int language plpgsql immutable as $$
begin
  return public.effective_free(rec, cur_period) + rec.balance;
end $$;

create or replace function public.available_credits()
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  rec public.user_credits;
begin
  if uid is null then return 0; end if;
  select * into rec from public.user_credits where user_id = uid;
  if not found then return 0; end if;
  return public._available_from_row(rec, to_char(now(), 'YYYY-MM-DD'));
end $$;

create or replace function public.reserve_credits(p_amount int, p_reason text default 'llm:hold')
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur_period text := to_char(now(), 'YYYY-MM-DD');
  rec public.user_credits;
  free_now int;
  from_free int;
  from_paid int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select * into rec from public.user_credits where user_id = uid for update;
  if not found then
    raise exception 'insufficient_credits';
  end if;

  if public._available_from_row(rec, cur_period) < p_amount then
    raise exception 'insufficient_credits';
  end if;

  free_now  := public.effective_free(rec, cur_period);
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

create or replace function public.spend_credits(p_amount int, p_reason text default 'llm')
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur_period text := to_char(now(), 'YYYY-MM-DD');
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
      values (uid, 0, public.daily_free(), cur_period)
      returning * into rec;
  end if;

  free_now  := public.effective_free(rec, cur_period);
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

create or replace function public.refund_credits(p_amount int, p_reason text default 'llm:refund')
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur_period text := to_char(now(), 'YYYY-MM-DD');
  rec public.user_credits;
  free_now int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select * into rec from public.user_credits where user_id = uid for update;
  if not found then
    insert into public.user_credits (user_id, balance, free_balance, free_period)
      values (uid, p_amount, public.daily_free(), cur_period)
      returning * into rec;
  else
    -- Refund restores PAID credits; also fold in any pending daily top-up so advancing the
    -- period here never eats a day's allowance.
    free_now := public.effective_free(rec, cur_period);
    update public.user_credits
      set balance      = balance + p_amount,
          free_balance = free_now,
          free_period  = cur_period,
          updated_at   = now()
      where user_id = uid
      returning * into rec;
  end if;

  insert into public.credit_transactions (user_id, delta, reason)
    values (uid, p_amount, p_reason);

  return public._available_from_row(rec, cur_period);
end $$;

-- New users start with today's free allowance.
create or replace function public.handle_new_user_credits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_credits (user_id, balance, free_balance, free_period)
    values (new.id, 0, public.daily_free(), to_char(now(), 'YYYY-MM-DD'))
    on conflict (user_id) do nothing;
  return new;
end $$;

-- Move existing users onto the daily model with today's allowance.
update public.user_credits
  set free_balance = least(public.free_cap(), public.daily_free()),
      free_period  = to_char(now(), 'YYYY-MM-DD');
