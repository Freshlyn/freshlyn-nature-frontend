alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.subscription_configs enable row level security;
alter table public.subscription_durations enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.subscription_deliveries enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

create policy addresses_select_own on public.addresses
  for select using (user_id = auth.uid());

create policy addresses_insert_own on public.addresses
  for insert with check (user_id = auth.uid());

create policy addresses_update_own on public.addresses
  for update using (user_id = auth.uid());

create policy addresses_delete_own on public.addresses
  for delete using (user_id = auth.uid());

create policy products_select_authenticated on public.products
  for select to authenticated using (true);

create policy product_variants_select_authenticated on public.product_variants
  for select to authenticated using (true);

create policy subscription_configs_select_authenticated on public.subscription_configs
  for select to authenticated using (true);

create policy subscription_durations_select_authenticated on public.subscription_durations
  for select to authenticated using (true);

create policy orders_select_own on public.orders
  for select using (user_id = auth.uid());

create policy order_items_select_own on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.user_id = auth.uid()
    )
  );

create policy subscription_deliveries_select_own on public.subscription_deliveries
  for select using (
    exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = subscription_deliveries.order_item_id
        and o.user_id = auth.uid()
    )
  );
