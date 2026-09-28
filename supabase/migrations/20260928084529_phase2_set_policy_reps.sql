-- Phase 2: a set must point to an exercise its owner may use, and carry 1 to 1000 reps.
--
-- The insert and update policies on workout_sets checked only the session owner.
-- They now also require the exercise to belong to the same user or to be a global
-- seed row (exercises.user_id is null).

drop policy if exists workout_sets_insert_own on public.workout_sets;
drop policy if exists workout_sets_update_own on public.workout_sets;

create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.exercises e
      where e.id = workout_sets.exercise_id
        and (e.user_id = (select auth.uid()) or e.user_id is null)
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
    and exists (
      select 1 from public.exercises e
      where e.id = workout_sets.exercise_id
        and (e.user_id = (select auth.uid()) or e.user_id is null)
    )
  );

alter table public.workout_sets
  alter column reps set not null;

alter table public.workout_sets
  add constraint workout_sets_reps_range check (reps between 1 and 1000);
