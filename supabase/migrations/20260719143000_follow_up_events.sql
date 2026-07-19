create table if not exists public.follow_up_events (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid references public.signals(id) on delete cascade,
  mention_id uuid references public.mentions(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  ticker text not null,
  company_name text,
  event_type text not null check (event_type in ('price_move', 'news', 'outcome', 'system')),
  severity text not null default 'info' check (severity in ('info', 'watch', 'important')),
  title text not null,
  summary text not null,
  source text not null,
  source_url text,
  observed_at timestamptz not null default now(),
  unique_event_key text not null unique,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists follow_up_events_observed_at_idx on public.follow_up_events(observed_at desc);
create index if not exists follow_up_events_signal_id_idx on public.follow_up_events(signal_id);
create index if not exists follow_up_events_ticker_idx on public.follow_up_events(ticker);

alter table public.follow_up_events enable row level security;

grant all on table public.follow_up_events to service_role;
