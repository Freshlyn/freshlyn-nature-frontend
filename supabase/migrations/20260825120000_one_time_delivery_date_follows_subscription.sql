-- A one-time item in a mixed order rides along with the subscription's first
-- delivery.
--
-- One-time items were always scheduled for tomorrow. That is right for an order
-- of one-time items alone, but wrong when the same order also carries a
-- subscription starting later: the customer gets one trip tomorrow and another
-- on the start date, and the app had no date to show for the one-time half
-- anyway. Sending both together on the subscription's first date is the
-- delivery the customer actually expects.
--
-- Floored at tomorrow. A start date is picked at checkout but the order row is
-- written when payment confirms, so a payment that sits pending overnight can
-- produce a first delivery dated today or earlier. Scheduling against it would
-- stamp an instant already in the past -- the same failure the original
-- "always tomorrow, never today" rule existed to prevent.
--
-- Not backfilled. Existing orders were scheduled under the old rule and may
-- already have been picked, packed, or delivered against it; rewriting their
-- dates now would move a commitment that has already been acted on.

create or replace function public.create_order(
  p_user_id uuid,
  p_address_id uuid,
  p_delivery_address text,
  p_items jsonb,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_total numeric,
  p_decrement_stock boolean default true,
  p_payment_method public.payment_method default 'cod',
  p_delivery_slot time default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_order_item_id uuid;
  v_item_count int;
  v_seq int;
  v_start_date date;
  v_scheduled_date date;
  v_interval int;
  v_lat double precision;
  v_lng double precision;
  v_pincode text;
  v_serviceable boolean;
  -- Earliest subscription start in this order, null when there are none. Read
  -- in a pass before the insert loop: the one-time branch needs it, and the
  -- subscription item that supplies it may appear after the one-time item.
  v_first_sub_date date;
  v_one_time_date date;
  -- Slot times are wall-clock times in the city we deliver to. timestamptz
  -- stores an absolute instant, so combining a date and a time without naming
  -- the zone would resolve against the server's UTC and shift every delivery
  -- by 5h30m -- a 07:00 slot would land at 12:30 IST.
  v_zone constant text := 'Asia/Kolkata';
begin
  select a.latitude, a.longitude, a.pincode
    into v_lat, v_lng, v_pincode
  from public.addresses a
  where a.id = p_address_id;

  if not found then
    raise exception 'address not serviceable' using errcode = 'P0001';
  end if;

  select cs.serviceable into v_serviceable
  from public.check_serviceability(v_lat, v_lng, v_pincode) cs;

  if v_serviceable is distinct from true then
    raise exception 'address not serviceable' using errcode = 'P0001';
  end if;

  v_item_count := jsonb_array_length(p_items);

  -- Mirrors the subscription branch's own seed below: an item with no start
  -- date begins today, so it must count as today here rather than be skipped.
  select min(coalesce(nullif(i->>'subscription_start_date', '')::date, current_date))
    into v_first_sub_date
  from jsonb_array_elements(p_items) i
  where i->>'delivery_type' is distinct from 'one_time';

  v_one_time_date := greatest(
    coalesce(v_first_sub_date, current_date + 1),
    current_date + 1
  );

  insert into public.orders (
    user_id, address_id, delivery_address, subtotal, delivery_fee, total, item_count,
    payment_method, delivery_slot
  ) values (
    p_user_id, p_address_id, p_delivery_address, p_subtotal, p_delivery_fee, p_total, v_item_count,
    p_payment_method, p_delivery_slot
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product_id, variant_id, quantity, unit_price, delivery_type,
      subscription_duration_days, subscription_frequency, discount_percent,
      subscription_start_date
    ) values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'variant_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      (v_item->>'delivery_type')::public.delivery_type,
      nullif(v_item->>'subscription_duration_days', '')::int,
      nullif(v_item->>'subscription_frequency', '')::public.subscription_frequency,
      nullif(v_item->>'discount_percent', '')::numeric,
      nullif(v_item->>'subscription_start_date', '')::date
    )
    returning id into v_order_item_id;

    if v_item->>'delivery_type' = 'one_time' then
      if p_decrement_stock then
        update public.product_variants
        set stock_quantity = stock_quantity - (v_item->>'quantity')::int
        where id = (v_item->>'variant_id')::uuid;
      end if;

      -- A one-time order is a subscription of exactly one delivery: tomorrow on
      -- its own, or the subscription's first date when this order has one.
      if p_delivery_slot is not null then
        insert into public.subscription_deliveries (
          order_item_id, sequence_number, scheduled_date, scheduled_at, status
        ) values (
          v_order_item_id,
          1,
          v_one_time_date,
          (v_one_time_date + p_delivery_slot) at time zone v_zone,
          'scheduled'
        );
      end if;
    else
      v_interval := case v_item->>'subscription_frequency'
        when 'daily' then 1
        when 'alternate' then 2
        when 'every_3rd' then 3
        else 1
      end;

      v_start_date := coalesce(
        nullif(v_item->>'subscription_start_date', '')::date,
        current_date
      );

      for v_seq in 1..(v_item->>'subscription_duration_days')::int loop
        v_scheduled_date := v_start_date + ((v_seq - 1) * v_interval);

        insert into public.subscription_deliveries (
          order_item_id, sequence_number, scheduled_date, scheduled_at, status
        ) values (
          v_order_item_id,
          v_seq,
          v_scheduled_date,
          case
            when p_delivery_slot is null then null
            else (v_scheduled_date + p_delivery_slot) at time zone v_zone
          end,
          'scheduled'
        );
      end loop;
    end if;
  end loop;

  return v_order_id;
end;
$$;

revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method, time) from public;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method, time) from anon;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method, time) from authenticated;
grant execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method, time) to service_role;
