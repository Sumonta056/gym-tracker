-- Phase 2: exercises, workout_sessions and workout_sets, plus two profiles columns.
--
-- Named exception to the db-migration skill: workout_sets carries no user_id.
-- The specification (section 5) gives the table none, so its policies read the
-- parent workout_sessions row with user_id = auth.uid() instead.
--
-- exercises.user_id may be null. A null row is a global seed row: every signed-in
-- user reads it, nobody writes it through the API.

create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid references auth.users (id) on delete cascade,
  name text not null,
  muscle_group text not null check (
    muscle_group in ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio')
  ),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  status text not null check (status in ('active', 'finished')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.workout_sets (
  id uuid primary key,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  set_index integer not null,
  reps integer,
  weight_kg numeric(6, 2),
  rpe integer check (rpe between 1 and 10),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.profiles
  add column if not exists rest_sound_muted boolean not null default false;

alter table public.profiles
  add column if not exists rest_seconds_by_exercise jsonb not null default '{}'::jsonb;

create index if not exists exercises_user_idx
  on public.exercises (user_id);

create unique index if not exists workout_sessions_one_active_idx
  on public.workout_sessions (user_id)
  where status = 'active' and deleted_at is null;

create index if not exists workout_sessions_user_date_idx
  on public.workout_sessions (user_id, entry_date);

create index if not exists workout_sets_session_idx
  on public.workout_sets (session_id);

create index if not exists workout_sets_exercise_idx
  on public.workout_sets (exercise_id);

alter table public.exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;

create policy exercises_select_own_or_global on public.exercises
  for select to authenticated
  using (user_id = (select auth.uid()) or user_id is null);

create policy exercises_insert_own on public.exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy exercises_update_own on public.exercises
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy exercises_delete_own on public.exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy workout_sessions_select_own on public.workout_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy workout_sessions_insert_own on public.workout_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy workout_sessions_update_own on public.workout_sessions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy workout_sessions_delete_own on public.workout_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy workout_sets_select_own on public.workout_sets
  for select to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = (select auth.uid())
    )
  );

create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = (select auth.uid())
    )
  );

create policy workout_sets_update_own on public.workout_sets
  for update to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = (select auth.uid())
    )
  );

create policy workout_sets_delete_own on public.workout_sets
  for delete to authenticated
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = (select auth.uid())
    )
  );

create trigger exercises_set_updated_at
  before update on public.exercises
  for each row execute function public.set_updated_at();

create trigger workout_sessions_set_updated_at
  before update on public.workout_sessions
  for each row execute function public.set_updated_at();

create trigger workout_sets_set_updated_at
  before update on public.workout_sets
  for each row execute function public.set_updated_at();
