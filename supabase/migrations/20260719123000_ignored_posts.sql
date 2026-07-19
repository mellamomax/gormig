create table if not exists public.ignored_posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  platform_post_id text not null,
  url text,
  caption text,
  reason text not null default 'manual_delete',
  raw_metadata jsonb not null default '{}'::jsonb,
  ignored_at timestamptz not null default now(),
  unique (creator_id, platform_post_id)
);

create index if not exists ignored_posts_creator_id_idx on public.ignored_posts(creator_id);

alter table public.ignored_posts enable row level security;

grant all on table public.ignored_posts to service_role;
