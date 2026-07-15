create table public.subscription_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  sequence_number int not null,
  scheduled_date date not null,
  status text not null default 'scheduled'
    check (status in ('scheduled','delivered','skipped','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id, sequence_number)
);

create trigger subscription_deliveries_set_updated_at
  before update on public.subscription_deliveries
  for each row execute function public.set_updated_at();

create function public.fn_append_makeup_delivery()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_frequency text;
  v_interval int;
  v_max_date date;
  v_max_seq int;
begin
  select oi.subscription_frequency into v_frequency
  from public.order_items oi
  where oi.id = new.order_item_id;

  v_interval := case v_frequency
    when 'daily' then 1
    when 'alternate' then 2
    when 'every_3rd' then 3
    else 1
  end;

  select max(scheduled_date), max(sequence_number)
  into v_max_date, v_max_seq
  from public.subscription_deliveries
  where order_item_id = new.order_item_id;

  insert into public.subscription_deliveries (order_item_id, sequence_number, scheduled_date, status)
  values (new.order_item_id, v_max_seq + 1, v_max_date + v_interval, 'scheduled');

  return new;
end;
$$;

create trigger trg_append_makeup_delivery
  after update of status on public.subscription_deliveries
  for each row
  when (new.status = 'skipped' and old.status is distinct from 'skipped')
  execute function public.fn_append_makeup_delivery();

create function public.fn_maybe_complete_order()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_order_id uuid;
  v_remaining int;
begin
  select o.id into v_order_id
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = new.order_item_id;

  select count(*) into v_remaining
  from public.subscription_deliveries sd
  join public.order_items oi on oi.id = sd.order_item_id
  where oi.order_id = v_order_id
    and oi.delivery_type = 'subscription'
    and sd.status <> 'delivered';

  if v_remaining = 0 then
    update public.orders set status = 'delivered' where id = v_order_id;
  end if;

  return new;
end;
$$;

create trigger trg_maybe_complete_order
  after update of status on public.subscription_deliveries
  for each row
  when (new.status = 'delivered')
  execute function public.fn_maybe_complete_order();

create function public.fn_decrement_stock_on_delivery()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_variant_id uuid;
  v_quantity int;
begin
  select oi.variant_id, oi.quantity into v_variant_id, v_quantity
  from public.order_items oi
  where oi.id = new.order_item_id;

  update public.product_variants
  set stock_quantity = stock_quantity - v_quantity
  where id = v_variant_id;

  return new;
end;
$$;

create trigger trg_decrement_stock_on_delivery
  after update of status on public.subscription_deliveries
  for each row
  when (new.status = 'delivered' and old.status is distinct from 'delivered')
  execute function public.fn_decrement_stock_on_delivery();
