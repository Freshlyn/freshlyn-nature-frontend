-- create_order gains p_decrement_stock.
--
-- COD orders are real the moment they are placed, so they keep decrementing at
-- creation (default true -- existing callers are unaffected). Razorpay orders
-- are created BEFORE payment, so decrementing here would let anyone destroy
-- inventory by opening the payment sheet and closing it. Their stock moves in
-- confirm_order_payment instead.
--
-- Subscription items are untouched by this flag either way: they never
-- decremented at creation, and their stock moves per-delivery through the
-- existing trg_decrement_stock_on_delivery trigger.
create or replace function public.create_order(
  p_user_id uuid,
  p_address_id uuid,
  p_delivery_address text,
  p_items jsonb,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_total numeric,
  p_decrement_stock boolean default true
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
begin
  v_item_count := jsonb_array_length(p_items);

  insert into public.orders (
    user_id, address_id, delivery_address, subtotal, delivery_fee, total, item_count
  ) values (
    p_user_id, p_address_id, p_delivery_address, p_subtotal, p_delivery_fee, p_total, v_item_count
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

revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean) from public;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean) from anon;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean) from authenticated;
grant execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean) to service_role;

-- The old 7-argument signature is now shadowed by the defaulted 8-argument one
-- and would make every call ambiguous. Drop it.
drop function if exists public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric);

-- C1: the webhook's authoritative success path. No authority guard -- it
-- overwrites whatever the client optimistically wrote.
--
-- The status write and the stock decrement share one function body, which is a
-- single transaction, so they can never half-apply.
create function public.confirm_order_payment(
  p_order_id uuid,
  p_payment_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set payment_status      = 'paid',
      payment_method      = 'razorpay',
      payment_authority   = 'webhook',
      razorpay_payment_id = p_payment_id,
      status              = case when status = 'pending' then 'confirmed' else status end
  where id = p_order_id
    -- Idempotency guard, scoped to a completed capture rather than to authority.
    --
    -- Guarding on authority alone would let a prior payment.failed (which also
    -- stamps 'webhook') permanently block the payment.captured that follows when
    -- a customer retries the same razorpay order and succeeds -- money taken,
    -- order left failed, no stock reserved. Success is terminal; failure is not.
    --
    -- Still not an authority guard in the C1 sense: a client-set 'paid'
    -- (authority 'client') does NOT match and is still overwritten.
    and not (payment_status = 'paid' and payment_authority = 'webhook');

  if not found then
    return;
  end if;

  -- Deferred decrement, mirroring create_order's one_time-only rule.
  --
  -- Aggregated by variant deliberately: UPDATE ... FROM joins each target row at
  -- most once, so two one_time items sharing a variant would silently apply only
  -- one of their quantities. create_order's per-item loop has no such weakness,
  -- and the two paths must not diverge.
  update public.product_variants pv
  set stock_quantity = pv.stock_quantity - agg.qty
  from (
    select oi.variant_id, sum(oi.quantity) as qty
    from public.order_items oi
    where oi.order_id = p_order_id
      and oi.delivery_type = 'one_time'
    group by oi.variant_id
  ) agg
  where pv.id = agg.variant_id;
end;
$$;

-- C1: the webhook's authoritative failure path. Moves no stock, because the
-- razorpay path never moved any in the first place.
create function public.fail_order_payment(
  p_order_id uuid,
  p_payment_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.orders
  set payment_status      = 'failed',
      payment_authority   = 'webhook',
      razorpay_payment_id = coalesce(p_payment_id, razorpay_payment_id)
  where id = p_order_id;
end;
$$;

-- C2: the client's optimistic write, guarded.
--
-- `and payment_authority is null` lives inside the UPDATE deliberately. A
-- read-then-write in TypeScript would leave a window in which the webhook lands
-- between the check and the write, letting the client overwrite it -- exactly
-- what C2 forbids. Folding the condition into the statement makes Postgres
-- serialise it; there is no window.
--
-- Returns true if the row was claimed, false if the webhook had already spoken.
create function public.client_mark_paid(
  p_order_id uuid,
  p_payment_id text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.orders
  set payment_status      = 'paid',
      payment_authority   = 'client',
      razorpay_payment_id = p_payment_id
  where id = p_order_id
    and payment_authority is null;

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.confirm_order_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.fail_order_payment(uuid, text) from public, anon, authenticated;
revoke execute on function public.client_mark_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_order_payment(uuid, text) to service_role;
grant execute on function public.fail_order_payment(uuid, text) to service_role;
grant execute on function public.client_mark_paid(uuid, text) to service_role;
