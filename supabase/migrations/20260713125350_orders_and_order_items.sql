create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  address_id uuid references public.addresses (id) on delete set null,
  delivery_address text not null,
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  item_count int not null,
  status text not null default 'pending'
    check (status in ('pending','confirmed','preparing','out_for_delivery','delivered','cancelled')),
  payment_status text not null default 'cod_pending'
    check (payment_status in ('cod_pending','cod_collected','paid','refunded')),
  payment_method text not null default 'cod'
    check (payment_method in ('cod','razorpay')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id),
  variant_id uuid not null references public.product_variants (id),
  quantity int not null,
  unit_price numeric(10,2) not null,
  delivery_type text not null check (delivery_type in ('one_time','subscription')),
  subscription_duration_days int,
  subscription_frequency text check (subscription_frequency in ('daily','alternate','every_3rd')),
  discount_percent numeric(5,2),
  created_at timestamptz not null default now()
);
