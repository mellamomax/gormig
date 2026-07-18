create extension if not exists pgcrypto;

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('tiktok')),
  username text not null,
  profile_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, username)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  platform_post_id text not null,
  url text not null,
  caption text,
  published_at timestamptz,
  cover_url text,
  media_url text,
  duration_seconds integer,
  transcript text,
  processing_status text not null default 'new' check (processing_status in ('new', 'processing', 'transcribed', 'analyzed', 'failed')),
  processing_error text,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, platform_post_id)
);

create table if not exists public.mentions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  company_name text not null,
  ticker text,
  exchange text,
  sentiment text not null check (sentiment in ('positive', 'negative', 'neutral')),
  thesis text not null,
  arguments text[] not null default '{}',
  risks text[] not null default '{}',
  catalysts text[] not null default '{}',
  mentioned_price text,
  time_horizon text,
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default now()
);

create table if not exists public.signals (
  id uuid primary key default gen_random_uuid(),
  mention_id uuid not null references public.mentions(id) on delete cascade,
  action text not null check (action in ('BUY_CANDIDATE', 'WATCH', 'HOLD', 'REDUCE', 'AVOID', 'INSUFFICIENT_DATA')),
  reasoning text not null,
  entry_condition text,
  invalidation_condition text,
  risk_level text not null check (risk_level in ('low', 'medium', 'high', 'unknown')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  generated_at timestamptz not null default now(),
  constraint signal_requires_reasoning check (length(trim(reasoning)) > 0 and length(trim(risk_level)) > 0)
);

create table if not exists public.run_logs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('manual_scrape', 'manual_transcript', 'manual_analysis', 'cron')),
  status text not null check (status in ('started', 'completed', 'failed')),
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_locks (
  key text primary key,
  locked_until timestamptz not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists creators_set_updated_at on public.creators;
create trigger creators_set_updated_at
before update on public.creators
for each row execute function public.set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create or replace function public.try_acquire_lock(lock_key text, hold_seconds integer)
returns boolean
language plpgsql
as $$
declare
  affected_rows integer;
begin
  insert into public.app_locks(key, locked_until)
  values (lock_key, now() + make_interval(secs => hold_seconds))
  on conflict (key) do update
    set locked_until = excluded.locked_until,
        updated_at = now()
    where public.app_locks.locked_until < now();

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.release_lock(lock_key text)
returns void
language plpgsql
as $$
begin
  update public.app_locks
  set locked_until = now(), updated_at = now()
  where key = lock_key;
end;
$$;

alter table public.creators enable row level security;
alter table public.posts enable row level security;
alter table public.mentions enable row level security;
alter table public.signals enable row level security;
alter table public.run_logs enable row level security;
alter table public.app_locks enable row level security;

grant all on table public.creators to service_role;
grant all on table public.posts to service_role;
grant all on table public.mentions to service_role;
grant all on table public.signals to service_role;
grant all on table public.run_logs to service_role;
grant all on table public.app_locks to service_role;

revoke all on function public.try_acquire_lock(text, integer) from public, anon, authenticated;
revoke all on function public.release_lock(text) from public, anon, authenticated;
grant execute on function public.try_acquire_lock(text, integer) to service_role;
grant execute on function public.release_lock(text) to service_role;
