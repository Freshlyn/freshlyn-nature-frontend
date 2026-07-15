create function public.create_order(
  p_user_id uuid,
  p_address_id uuid,
  p_delivery_address text,
  p_items jsonb,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_total numeric
)
returns uuid
language plpgsql
security definer set search_path = public
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
      v_item->>'delivery_type',
      nullif(v_item->>'subscription_duration_days', '')::int,
      nullif(v_item->>'subscription_frequency', ''),
      nullif(v_item->>'discount_percent', '')::numeric
    )
    returning id into v_order_item_id;

    if v_item->>'delivery_type' = 'one_time' then
      update public.product_variants
      set stock_quantity = stock_quantity - (v_item->>'quantity')::int
      where id = (v_item->>'variant_id')::uuid;
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

revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric) from public;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric) from anon;
revoke execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric) from authenticated;
grant execute on function public.create_order(uuid, uuid, text, jsonb, numeric, numeric, numeric) to service_role;
