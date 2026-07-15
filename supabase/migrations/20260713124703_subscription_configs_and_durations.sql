create table public.subscription_configs (
  product_id uuid primary key references public.products (id) on delete cascade,
  enabled boolean not null default false,
  frequencies text[] not null default '{}'
);

alter table public.subscription_configs
  add constraint subscription_configs_frequencies_check
  check (frequencies <@ array['daily','alternate','every_3rd']::text[]);

create table public.subscription_durations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.subscription_configs (product_id) on delete cascade,
  duration_days int not null,
  label text not null,
  discount_percent numeric(5,2) not null default 0,
  unique (product_id, duration_days)
);
