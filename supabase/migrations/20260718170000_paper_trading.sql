create table if not exists public.paper_settings (
  id boolean primary key default true check (id = true),
  enabled boolean not null default false,
  starting_cash numeric not null default 100000,
  allocation_per_trade numeric not null default 10000,
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.paper_settings(id, enabled, starting_cash, allocation_per_trade)
values (true, false, 100000, 10000)
on conflict (id) do nothing;

create table if not exists public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  signal_id uuid not null references public.signals(id) on delete cascade,
  mention_id uuid not null references public.mentions(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  ticker text not null,
  company_name text not null,
  action text not null,
  status text not null default 'planned' check (status in ('planned', 'settled', 'ignored')),
  allocated_cash numeric not null,
  horizon_label text,
  horizon_days integer,
  planned_entry_at timestamptz not null default now(),
  planned_exit_date date,
  thesis text,
  expectation text,
  risk_level text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (signal_id)
);

alter table public.paper_settings enable row level security;
alter table public.paper_trades enable row level security;

grant all on table public.paper_settings to service_role;
grant all on table public.paper_trades to service_role;

drop trigger if exists paper_settings_set_updated_at on public.paper_settings;
create trigger paper_settings_set_updated_at
before update on public.paper_settings
for each row execute function public.set_updated_at();

drop trigger if exists paper_trades_set_updated_at on public.paper_trades;
create trigger paper_trades_set_updated_at
before update on public.paper_trades
for each row execute function public.set_updated_at();