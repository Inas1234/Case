-- Case app baseline schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

-- =========
-- Functions
-- =========

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  candidate text;
begin
  base_username := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  if base_username is null then
    base_username := split_part(coalesce(new.email, ''), '@', 1);
  end if;

  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]', '_', 'g');
  candidate := left(base_username, 20);

  if candidate is null or candidate = '' then
    candidate := 'user_' || substr(new.id::text, 1, 8);
  end if;

  if exists (select 1 from public.profiles p where lower(p.username) = lower(candidate)) then
    candidate := left(candidate, 12) || '_' || substr(new.id::text, 1, 6);
  end if;

  insert into public.profiles (id, username, display_name)
  values (new.id, candidate, coalesce(new.raw_user_meta_data ->> 'username', candidate))
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ======
-- Tables
-- ======

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_lower_unique_idx
  on public.profiles (lower(username));

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Untitled Case',
  board_type text not null default 'Blank'
    check (board_type in ('Startup', 'Product', 'Blank')),
  status text not null default 'Open'
    check (status in (
      'Open',
      'Under Investigation',
      'Narrowing',
      'Ready for Verdict',
      'Solved',
      'Archived'
    )),
  verdict text
    check (verdict in ('Proceed', 'Test first', 'Pivot', 'Pause', 'Kill')),
  thesis text not null default '',
  top_risk text not null default '',
  top_open_questions jsonb not null default '[]'::jsonb,
  recommended_next_step text not null default '',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_owner_idx on public.boards(owner_id);
create index if not exists boards_status_idx on public.boards(status);

create table if not exists public.board_cards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  type text not null
    check (type in (
      'Thought',
      'Question',
      'Evidence',
      'Screenshot',
      'Assumption',
      'Risk',
      'Contradiction',
      'Experiment',
      'Conclusion'
    )),
  title text not null,
  content text not null default '',
  tags text[] not null default '{}',
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  ai_origin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists board_cards_board_idx on public.board_cards(board_id);
create index if not exists board_cards_type_idx on public.board_cards(type);

create table if not exists public.board_ai_actions (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  role text not null check (role in ('Skeptic', 'Scientist', 'Market Analyst')),
  action text not null check (action in (
    'Organize',
    'Challenge',
    'Find contradictions',
    'Compress',
    'Suggest next test'
  )),
  output_summary text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists board_ai_actions_board_idx on public.board_ai_actions(board_id);

create table if not exists public.board_exports (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  format text not null check (format in ('markdown', 'json')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists board_exports_board_idx on public.board_exports(board_id);

-- ========
-- Triggers
-- ========

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists boards_set_updated_at on public.boards;
create trigger boards_set_updated_at
before update on public.boards
for each row
execute function public.set_updated_at();

drop trigger if exists board_cards_set_updated_at on public.board_cards;
create trigger board_cards_set_updated_at
before update on public.board_cards
for each row
execute function public.set_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

-- ==========
-- RLS Policy
-- ==========

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_cards enable row level security;
alter table public.board_ai_actions enable row level security;
alter table public.board_exports enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "boards_select_own" on public.boards;
create policy "boards_select_own"
on public.boards
for select
using (owner_id = auth.uid());

drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own"
on public.boards
for insert
with check (owner_id = auth.uid());

drop policy if exists "boards_update_own" on public.boards;
create policy "boards_update_own"
on public.boards
for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "boards_delete_own" on public.boards;
create policy "boards_delete_own"
on public.boards
for delete
using (owner_id = auth.uid());

drop policy if exists "board_cards_select_owner" on public.board_cards;
create policy "board_cards_select_owner"
on public.board_cards
for select
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "board_cards_insert_owner" on public.board_cards;
create policy "board_cards_insert_owner"
on public.board_cards
for insert
with check (
  exists (
    select 1
    from public.boards b
    where b.id = board_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "board_cards_update_owner" on public.board_cards;
create policy "board_cards_update_owner"
on public.board_cards
for update
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.boards b
    where b.id = board_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "board_cards_delete_owner" on public.board_cards;
create policy "board_cards_delete_owner"
on public.board_cards
for delete
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "board_ai_actions_owner_access" on public.board_ai_actions;
create policy "board_ai_actions_owner_access"
on public.board_ai_actions
for all
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.boards b
    where b.id = board_id and b.owner_id = auth.uid()
  )
);

drop policy if exists "board_exports_owner_access" on public.board_exports;
create policy "board_exports_owner_access"
on public.board_exports
for all
using (
  exists (
    select 1
    from public.boards b
    where b.id = board_id and b.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.boards b
    where b.id = board_id and b.owner_id = auth.uid()
  )
);
