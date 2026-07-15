create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null,
  image_url text,
  unit text not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,
  quantity_value numeric not null,
  quantity_unit text not null,
  price numeric(10,2) not null,
  stock_quantity int not null default 0,
  max_quantity_per_order int not null default 100,
  is_default boolean not null default false
);
