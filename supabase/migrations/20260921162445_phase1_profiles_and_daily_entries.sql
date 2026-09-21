create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  unit_system text not null default 'metric' check (unit_system in ('metric', 'imperial')),
  height_cm numeric(5, 1),
  target_weight_kg numeric(5, 2),
  step_goal integer not null default 12000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  walk_seconds integer,
  gym_seconds integer,
  avg_heart_rate integer,
  max_heart_rate integer,
  weight_kg numeric(5, 2),
  calories_burnt integer,
  steps integer,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists daily_entries_user_date_live_idx
  on public.daily_entries (user_id, entry_date)
  where deleted_at is null;

create index if not exists daily_entries_user_updated_idx
  on public.daily_entries (user_id, updated_at);

alter table public.profiles enable row level security;
alter table public.daily_entries enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_delete_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select using (id = (select auth.uid()));

create policy profiles_insert_own on public.profiles
  for insert with check (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy profiles_delete_own on public.profiles
  for delete using (id = (select auth.uid()));

drop policy if exists daily_entries_select_own on public.daily_entries;
drop policy if exists daily_entries_insert_own on public.daily_entries;
drop policy if exists daily_entries_update_own on public.daily_entries;
drop policy if exists daily_entries_delete_own on public.daily_entries;

create policy daily_entries_select_own on public.daily_entries
  for select using (user_id = (select auth.uid()));

create policy daily_entries_insert_own on public.daily_entries
  for insert with check (user_id = (select auth.uid()));

create policy daily_entries_update_own on public.daily_entries
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy daily_entries_delete_own on public.daily_entries
  for delete using (user_id = (select auth.uid()));

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists daily_entries_set_updated_at on public.daily_entries;
create trigger daily_entries_set_updated_at
  before update on public.daily_entries
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
