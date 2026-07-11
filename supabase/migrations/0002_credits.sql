-- Credits & payments. Run this in the Supabase dashboard SQL editor (no CLI in this project).
-- Money path: writes go ONLY through SECURITY DEFINER functions (spend/grant) or the
-- service-role webhook, never directly from the client. Users can only READ their own rows.

-- Balance: one row per user.
create table if not exists public.user_credits (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  balance     int not null default 0,
  updated_at  timestamptz not null default now()
);

-- Append-only ledger: every grant (+) and spend (-). The audit trail for money.
create table if not exists public.credit_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  delta       int not null,
  reason      text not null,           -- 'purchase' | 'llm' | 'signup-bonus' | ...
  ref         text,                    -- Stripe session id for purchases (idempotency key)
  created_at  timestamptz not null default now()
);

create index if not exists credit_transactions_user_idx
  on public.credit_transactions (user_id, created_at desc);

-- One row per Stripe session: webhook retries can't double-credit.
create unique index if not exists credit_transactions_ref_idx
  on public.credit_transactions (ref) where ref is not null;

-- RLS: read-your-own only. No write policies, the DEFINER functions below own the writes.
alter table public.user_credits enable row level security;
alter table public.credit_transactions enable row level security;

drop policy if exists "own credits" on public.user_credits;
create policy "own credits" on public.user_credits
  for select using (auth.uid() = user_id);

drop policy if exists "own transactions" on public.credit_transactions;
create policy "own transactions" on public.credit_transactions
  for select using (auth.uid() = user_id);

-- Spend: atomic deduct for the calling user. The UPDATE takes a row lock, so concurrent
-- calls serialize. Returns the new balance.
create or replace function public.spend_credits(p_amount int, p_reason text default 'llm')
returns int language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  new_balance int;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;

  update public.user_credits
    set balance = balance - p_amount, updated_at = now()
    where user_id = uid
    returning balance into new_balance;

  if new_balance is null then
    insert into public.user_credits (user_id, balance) values (uid, -p_amount)
      returning balance into new_balance;
  end if;

  insert into public.credit_transactions (user_id, delta, reason)
    values (uid, -p_amount, p_reason);
  return new_balance;
end $$;

-- Grant: called by the Stripe webhook via the service role (no auth.uid()). Idempotent on
-- p_ref so replayed webhook events don't credit twice.
create or replace function public.grant_credits(p_user uuid, p_amount int, p_ref text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_amount <= 0 then raise exception 'amount must be positive'; end if;
  if p_ref is not null and exists (
    select 1 from public.credit_transactions where ref = p_ref
  ) then
    return; -- already processed this Stripe session
  end if;

  insert into public.user_credits (user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update
      set balance = public.user_credits.balance + p_amount, updated_at = now();

  insert into public.credit_transactions (user_id, delta, reason, ref)
    values (p_user, p_amount, 'purchase', p_ref);
end $$;

-- Give every new user a starter balance (100 credits ~= 100k billable tokens). Knob: change 100.
create or replace function public.handle_new_user_credits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_credits (user_id, balance) values (new.id, 100)
    on conflict (user_id) do nothing;
  insert into public.credit_transactions (user_id, delta, reason)
    values (new.id, 100, 'signup-bonus');
  return new;
end $$;

drop trigger if exists on_auth_user_created_credits on auth.users;
create trigger on_auth_user_created_credits
  after insert on auth.users
  for each row execute function public.handle_new_user_credits();

-- Backfill existing users so they aren't locked out.
insert into public.user_credits (user_id, balance)
  select id, 100 from auth.users
  on conflict (user_id) do nothing;
