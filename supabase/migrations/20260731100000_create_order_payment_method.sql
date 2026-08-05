-- F2: create_order gains p_payment_method so the order row is born with its
-- final payment method.
--
-- Previously the checkout function inserted the row at the column DEFAULT 'cod'
-- and flipped it to 'razorpay' in a separate UPDATE one statement later. The
-- supersede sweep that runs before creation filters on payment_method =
-- 'razorpay', so a concurrent checkout sweeping during that window would MISS a
-- sibling order that was still nominally 'cod'. Two live payable razorpay
-- orders would survive, both webhooks would confirm, and stock would be
-- decremented twice for one intended purchase. Writing the method in the same
-- INSERT closes the window entirely.
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
begin
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

revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method) from public;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method) from anon;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method) from authenticated;
grant execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean, public.payment_method) to service_role;

-- Adding a defaulted parameter creates a NEW overload rather than replacing the
-- old one, which would make every 7- or 8-argument call ambiguous. Drop the
-- 8-argument signature, exactly as 20260731090300 had to drop the 7-argument
-- one for the same reason.
drop function if exists public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric, boolean);

-- F3: fail_order_payment must not overwrite a webhook-confirmed capture.
--
-- Razorpay does not guarantee event ordering and its retries reorder freely, so
-- a retried payment.failed for an earlier attempt can arrive AFTER the
-- payment.captured for the successful one. The payment_events dedup does not
-- help: the two rows differ in event_type and both pass the unique key by
-- design. Without this guard the order flips to 'failed' while the stock stays
-- decremented and the money stays captured.
--
-- The guard is symmetric with confirm_order_payment's: success is terminal,
-- failure is not. It is scoped to (paid + webhook), so C1 still holds -- a
-- client-set 'paid' (authority 'client') does NOT match and remains
-- overwritable by the webhook.
create or replace function public.fail_order_payment(
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
  where id = p_order_id
    and not (payment_status = 'paid' and payment_authority = 'webhook');
end;
$$;
