-- Delivery time and delivery date become stored facts.
--
-- Three related gaps closed here:
--
--   1. The delivery time the customer picked never left the browser. Cart.tsx
--      held it in React state, dropped it at the checkout call, and no column
--      existed to receive it.
--   2. The subscription start date DID reach this function, but only as the
--      seed for the scheduled_date loop. It was never stored, so once a
--      delivery is skipped or rescheduled, min(scheduled_date) stops meaning
--      "what the customer chose" and the original intent is unrecoverable.
--   3. subscription_deliveries recorded a date but no time, so nothing in the
--      database said when a delivery was actually due. OrderDetail.tsx papered
--      over this by computing dates from orders.created_at and printing a
--      hardcoded "9:00 AM".
--
-- Columns are nullable and are NOT backfilled. Existing rows genuinely have no
-- chosen slot or start date; inventing one would fabricate a delivery
-- commitment that no customer ever made. Old orders render an empty schedule.

alter table public.orders
  add column delivery_slot time;

alter table public.order_items
  add column subscription_start_date date;

alter table public.subscription_deliveries
  add column scheduled_at timestamptz;

comment on column public.orders.delivery_slot is
  'The delivery time the customer selected at checkout. Their stated preference, kept alongside the derived scheduled_at values so intent survives a change to the scheduling rule.';

comment on column public.order_items.subscription_start_date is
  'The first delivery date the customer picked. Stored rather than inferred from min(scheduled_date), which drifts once deliveries are skipped or rescheduled.';

comment on column public.subscription_deliveries.scheduled_at is
  'The exact instant this delivery is due: scheduled_date combined with the order delivery_slot, anchored to Asia/Kolkata.';

-- Index the schedule, not the calendar date: every ops query ("what goes out in
-- the next hour", "what is overdue") is a range over the instant.
create index subscription_deliveries_scheduled_at_idx
  on public.subscription_deliveries (scheduled_at)
  where status = 'scheduled';

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

      -- A one-time order is a subscription of exactly one delivery, scheduled
      -- for tomorrow. Always tomorrow, never today: an order placed at 14:00
      -- against an 07:00 slot would otherwise be stamped with an instant that
      -- has already passed.
      if p_delivery_slot is not null then
        insert into public.subscription_deliveries (
          order_item_id, sequence_number, scheduled_date, scheduled_at, status
        ) values (
          v_order_item_id,
          1,
          (current_date + 1),
          ((current_date + 1) + p_delivery_slot) at time zone v_zone,
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

-- Drop the previous signature so callers cannot silently resolve to a version
-- that ignores the slot.
drop function if exists public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method);
