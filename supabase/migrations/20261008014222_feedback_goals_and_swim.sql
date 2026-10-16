alter table public.profiles
  add column if not exists calorie_goal integer
    constraint profiles_calorie_goal_range check (calorie_goal between 1 and 10000),
  add column if not exists gym_goal_seconds integer
    constraint profiles_gym_goal_seconds_range check (gym_goal_seconds between 60 and 86400),
  add column if not exists walk_goal_seconds integer
    constraint profiles_walk_goal_seconds_range check (walk_goal_seconds between 60 and 86400),
  add column if not exists sessions_per_week_goal integer
    constraint profiles_sessions_per_week_goal_range
      check (sessions_per_week_goal between 1 and 14),
  add column if not exists birth_year integer
    constraint profiles_birth_year_range check (birth_year between 1900 and 2100),
  add column if not exists max_heart_rate integer
    constraint profiles_max_heart_rate_range check (max_heart_rate between 30 and 230),
  add column if not exists stats_layout jsonb
    constraint profiles_stats_layout_array check (jsonb_typeof(stats_layout) = 'array');

alter table public.daily_entries
  add column if not exists swim_seconds integer
    constraint daily_entries_swim_seconds_range check (swim_seconds between 0 and 86400);
