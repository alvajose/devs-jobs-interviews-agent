-- Abuse defense: atomic credit reservation, rate limiting, and non-negative spends.
-- Run after 0008. Idempotent where noted.

-- ---------------------------------------------------------------------------
-- Credit reservation (prevents concurrent LLM calls from overspending)
-- ---------------------------------------------------------------------------

create or replace function public._available_from_row(
  rec public.user_credits,
  cur_period text
) returns int language plpgsql immutable as $$
declare
  free_now int;
begin
  free_now := case when rec.free_period <> cur_period
                   then public.monthly_free() else rec.free_balance end;
  return free_now + rec.balance;
end $$;

-- Reserve credits up front. Fails closed when the effective balance is too low.
create or replace function public.reserve_credits(p_amount int, p_reason text default 'llm:hold')
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur_period text := to_char(now(), 'YYYY-MM');
  rec public.user_credits;
  available int;
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

  available := public._available_from_row(rec, cur_period);
  if available < p_amount then
    raise exception 'insufficient_credits';
  end if;

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

-- Refund a prior reservation when the LLM call fails after the hold.
create or replace function public.refund_credits(p_amount int, p_reason text default 'llm:refund')
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur_period text := to_char(now(), 'YYYY-MM');
  rec public.user_credits;
  to_free int;
  to_paid int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  select * into rec from public.user_credits where user_id = uid for update;
  if not found then
    insert into public.user_credits (user_id, balance, free_balance, free_period)
      values (uid, p_amount, 0, cur_period)
      returning * into rec;
  else
    -- Prefer restoring paid credits first (inverse of spend order).
    to_paid := p_amount;
    to_free := 0;
    update public.user_credits
      set balance = balance + to_paid,
          free_balance = free_balance + to_free,
          free_period = cur_period,
          updated_at = now()
      where user_id = uid
      returning * into rec;
  end if;

  insert into public.credit_transactions (user_id, delta, reason)
    values (uid, p_amount, p_reason);

  return public._available_from_row(rec, cur_period);
end $$;

-- Spend only when the user still has enough (no negative balance).
create or replace function public.spend_credits(p_amount int, p_reason text default 'llm')
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur_period text := to_char(now(), 'YYYY-MM');
  rec public.user_credits;
  available int;
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

  available := public._available_from_row(rec, cur_period);
  if available < p_amount then
    raise exception 'insufficient_credits';
  end if;

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

-- ---------------------------------------------------------------------------
-- Rate limiting for LLM routes (per user + per IP)
-- ---------------------------------------------------------------------------

create table if not exists public.api_request_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  ip         text not null default 'unknown',
  route      text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_request_log_user_route_idx
  on public.api_request_log (user_id, route, created_at desc);

create index if not exists api_request_log_ip_route_idx
  on public.api_request_log (ip, route, created_at desc);

alter table public.api_request_log enable row level security;

-- No direct client access; writes go through the RPC below.
drop policy if exists "no direct api_request_log access" on public.api_request_log;

create or replace function public.try_log_llm_request(
  p_route text,
  p_ip text,
  p_user_limit int default 8,
  p_ip_limit int default 20,
  p_window_seconds int default 60
) returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  since timestamptz := now() - make_interval(secs => greatest(p_window_seconds, 1));
  user_count int;
  ip_count int;
  normalized_ip text := coalesce(nullif(trim(p_ip), ''), 'unknown');
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_route is null or length(trim(p_route)) = 0 then
    raise exception 'route required';
  end if;

  select count(*) into user_count
    from public.api_request_log
    where user_id = uid
      and route = p_route
      and created_at >= since;

  if user_count >= greatest(p_user_limit, 1) then
    return false;
  end if;

  select count(*) into ip_count
    from public.api_request_log
    where ip = normalized_ip
      and route = p_route
      and created_at >= since;

  if ip_count >= greatest(p_ip_limit, 1) then
    return false;
  end if;

  insert into public.api_request_log (user_id, ip, route)
    values (uid, normalized_ip, p_route);

  return true;
end $$;
