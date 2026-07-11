-- Conversations: one row per chat/roadmap session, owned by a user.
-- Run this in the Supabase dashboard SQL editor (no CLI in this project).

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default 'New roadmap',
  profile     jsonb not null default '{}'::jsonb,
  messages    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists conversations_user_updated_idx
  on public.conversations (user_id, updated_at desc);

-- Row Level Security: a user can only touch their own rows. This is the
-- security boundary, without it, the anon key would expose every user's chats.
alter table public.conversations enable row level security;

drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on every write so the list orders by real recency.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.touch_updated_at();
