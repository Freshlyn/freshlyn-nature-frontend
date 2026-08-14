-- G1: create_order refuses an order to an address outside every coverage area.
--
-- This is the enforcement layer. The three client-side checks (app open,
-- address save, checkout screen) are advisory: they run in the browser, can be
-- bypassed by a patched client, and can be stale if a zone changed mid-session.
-- This one runs inside the transaction that creates the order, so it is the
-- only check that actually protects the business.
--
-- The verdict is computed from the ADDRESS ROW's stored values, never from a
-- live device position. That is what makes subscriptions work with no special
-- case: every subscription_deliveries row for this order is generated below,
-- inside this same call, so gating here gates them too.
--
-- Placement matters: resolve the address, check, raise -- all BEFORE the
-- insert into orders and before any stock is touched. A blocked order leaves
-- no residue: no order row, no reserved stock, no subscription deliveries.
create or replace function public.create_order(
  p_user_id uuid,
  p_address_id uuid,
  p_delivery_address text,
  p_items jsonb,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_total numeric,
  p_decrement_stock boolean default true,
  p_payment_method public.payment_method default 'cod'
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
  v_interval int;
  v_lat double precision;
  v_lng double precision;
  v_pincode text;
  v_serviceable boolean;
begin
  select a.latitude, a.longitude, a.pincode
    into v_lat, v_lng, v_pincode
  from public.addresses a
  where a.id = p_address_id;

  -- Fail closed. A missing address row is not an inconclusive result to be
  -- waved through: for a delivery business, accepting an order that cannot be
  -- fulfilled costs a refund, a wasted delivery attempt and customer trust,
  -- while rejecting a legitimate one costs one order. The asymmetry is why
  -- every uncertain path here rejects.
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
    payment_method
  ) values (
    p_user_id, p_address_id, p_delivery_address, p_subtotal, p_delivery_fee, p_total, v_item_count,
    p_payment_method
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product_id, variant_id, quantity, unit_price, delivery_type,
      subscription_duration_days, subscription_frequency, discount_percent
    ) values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'variant_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      (v_item->>'delivery_type')::public.delivery_type,
      nullif(v_item->>'subscription_duration_days', '')::int,
      nullif(v_item->>'subscription_frequency', '')::public.subscription_frequency,
      nullif(v_item->>'discount_percent', '')::numeric
    )
    returning id into v_order_item_id;

    if v_item->>'delivery_type' = 'one_time' then
      if p_decrement_stock then
        update public.product_variants
        set stock_quantity = stock_quantity - (v_item->>'quantity')::int
        where id = (v_item->>'variant_id')::uuid;
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
        insert into public.subscription_deliveries (
          order_item_id, sequence_number, scheduled_date, status
        ) values (
          v_order_item_id,
          v_seq,
          v_start_date + ((v_seq - 1) * v_interval),
          'scheduled'
        );
      end loop;
    end if;
  end loop;

  return v_order_id;
end;
$$;

-- create or replace does not alter grants, but restate them so this file is
-- self-describing: the RPC is reachable only through the checkout Edge
-- Function, never directly from a browser.
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method) from public;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method) from anon;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method) from authenticated;
grant execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method) to service_role;
