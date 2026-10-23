create table if not exists public.video_categories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null
    constraint video_categories_name_length check (char_length(name) between 1 and 40),
  color text not null
    constraint video_categories_color_known check (
      color in ('data-cyan', 'data-violet', 'data-pink', 'data-blue', 'data-yellow', 'data-slate')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.saved_videos (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  url text not null
    constraint saved_videos_url_length check (char_length(url) between 1 and 2048)
    constraint saved_videos_url_web check (url ~* '^https?://'),
  title text not null
    constraint saved_videos_title_length check (char_length(title) between 1 and 120),
  category_id uuid not null references public.video_categories (id),
  tags text[] not null default '{}'
    constraint saved_videos_tags_count check (cardinality(tags) <= 10),
  priority text not null default 'normal'
    constraint saved_videos_priority_known check (priority in ('high', 'normal', 'low')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists video_categories_user_updated_idx
  on public.video_categories (user_id, updated_at);

create index if not exists saved_videos_user_updated_idx
  on public.saved_videos (user_id, updated_at);

create index if not exists saved_videos_category_idx
  on public.saved_videos (category_id);

alter table public.video_categories enable row level security;
alter table public.saved_videos enable row level security;

create policy video_categories_select_own on public.video_categories
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy video_categories_insert_own on public.video_categories
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy video_categories_update_own on public.video_categories
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy video_categories_delete_own on public.video_categories
  for delete to authenticated
  using (user_id = (select auth.uid()));

create policy saved_videos_select_own on public.saved_videos
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy saved_videos_insert_own on public.saved_videos
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.video_categories c
      where c.id = saved_videos.category_id and c.user_id = (select auth.uid())
    )
  );

create policy saved_videos_update_own on public.saved_videos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.video_categories c
      where c.id = saved_videos.category_id and c.user_id = (select auth.uid())
    )
  );

create policy saved_videos_delete_own on public.saved_videos
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger video_categories_set_updated_at
  before update on public.video_categories
  for each row execute function public.set_updated_at();

create trigger saved_videos_set_updated_at
  before update on public.saved_videos
  for each row execute function public.set_updated_at();
