-- The delivery triggers were written when only subscription items had rows in
-- subscription_deliveries. One-time items have had a row since 20260820120000,
-- and each of the three triggers is wrong for them in a different way.
--
-- None of this is new breakage from the one-time delivery date change; that
-- change only made the rows visible in the UI, which is how these surfaced.

-- 1. fn_decrement_stock_on_delivery: double-counts one-time stock.
--
-- create_order already decrements stock for a one-time item at order time
-- (p_decrement_stock). This trigger then decrements the SAME item again when
-- its delivery is marked delivered, so ordering 3 units removes 6 from
-- inventory. Subscriptions are not affected: their stock is deliberately taken
-- per delivery, which is exactly what this trigger exists to do.
create or replace function public.fn_decrement_stock_on_delivery()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_variant_id uuid;
  v_quantity int;
  v_delivery_type public.delivery_type;
begin
  select oi.variant_id, oi.quantity, oi.delivery_type
    into v_variant_id, v_quantity, v_delivery_type
  from public.order_items oi
  where oi.id = new.order_item_id;

  -- A one-time item's stock was already taken at checkout.
  if v_delivery_type = 'one_time' then
    return new;
  end if;

  update public.product_variants
  set stock_quantity = stock_quantity - v_quantity
  where id = v_variant_id;

  return new;
end;
$$;

-- 2. fn_append_makeup_delivery: turns a skipped one-time item into a series.
--
-- A make-up delivery is a subscription concept: skip one of N deliveries and
-- the plan owes you another. A one-time purchase owes nothing -- skipping it
-- should leave it skipped. Worse, the function reads subscription_frequency to
-- space the new row, which is null for a one-time item and silently falls
-- through to a 1-day interval.
create or replace function public.fn_append_makeup_delivery()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_frequency text;
  v_interval int;
  v_max_date date;
  v_max_seq int;
  v_slot time;
  v_scheduled_date date;
  v_delivery_type public.delivery_type;
  -- Must match create_order. Combining a date and a time without naming the
  -- zone resolves against the server's UTC and shifts the delivery by 5h30m --
  -- a 07:00 slot would land at 12:30 IST.
  v_zone constant text := 'Asia/Kolkata';
begin
  select oi.subscription_frequency, o.delivery_slot, oi.delivery_type
    into v_frequency, v_slot, v_delivery_type
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.id = new.order_item_id;

  -- Nothing is owed for a skipped one-time item.
  if v_delivery_type = 'one_time' then
    return new;
  end if;

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

  v_scheduled_date := v_max_date + v_interval;

  insert into public.subscription_deliveries (
    order_item_id, sequence_number, scheduled_date, scheduled_at, status
  ) values (
    new.order_item_id,
    v_max_seq + 1,
    v_scheduled_date,
    case
      when v_slot is null then null
      else (v_scheduled_date + v_slot) at time zone v_zone
    end,
    'scheduled'
  );

  return new;
end;
$$;

-- 3. fn_maybe_complete_order: marks a mixed order delivered too early.
--
-- The remaining-deliveries count filters to delivery_type = 'subscription', so
-- a mixed order flips to 'delivered' as soon as its subscription deliveries
-- land -- while the one-time item is still sitting at 'scheduled'. The order
-- detail page then shows a delivered order containing an undelivered item.
--
-- Dropping the filter counts every delivery in the order, which is the
-- question the function is actually asking. Pure-subscription orders are
-- unaffected: they have no one-time rows to count.
--
-- 'skipped' and 'cancelled' rows still block completion, exactly as before --
-- a skipped subscription delivery appends a make-up row, so the order is
-- genuinely not finished.
create or replace function public.fn_maybe_complete_order()
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
    and sd.status <> 'delivered';

  if v_remaining = 0 then
    update public.orders set status = 'delivered' where id = v_order_id;
  end if;

  return new;
end;
$$;
