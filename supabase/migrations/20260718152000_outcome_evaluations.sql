create table if not exists public.outcome_evaluations (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.signals(id) on delete cascade,
  mention_id uuid not null references public.mentions(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  ticker text not null,
  exchange text,
  action text not null,
  horizon_label text,
  horizon_days integer,
  start_date date,
  target_date date,
  start_price numeric,
  target_price numeric,
  return_pct numeric,
  is_success boolean,
  verdict text not null check (verdict in ('PENDING', 'NO_DATA', 'POSITIVE_HIT', 'NEGATIVE_HIT', 'NEUTRAL_HIT', 'MISS', 'IGNORED')),
  notes text,
  source text not null default 'alpha_vantage',
  raw_data jsonb not null default '{}'::jsonb,
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (signal_id)
);

alter table public.outcome_evaluations enable row level security;
grant all on table public.outcome_evaluations to service_role;
