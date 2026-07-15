begin;
select plan(7);

insert into auth.users (id, phone, email) values
  ('a0000000-0000-0000-0000-00000000000a', '+911111111111', 'buyer@example.com');

insert into public.addresses (id, user_id, label, flat_house, city, state, pincode, is_default)
values ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'Home', 'Flat 1', 'Mumbai', 'Maharashtra', '400001', true);

insert into public.products (id, name, category, unit) values
  ('c0000000-0000-0000-0000-00000000000c', 'Test Milk', 'dairy', 'L');

insert into public.product_variants (id, product_id, name, quantity_value, quantity_unit, price, stock_quantity, is_default)
values
  ('d0000000-0000-0000-0000-00000000000d', 'c0000000-0000-0000-0000-00000000000c', '1L', 1, 'L', 2.99, 100, true),
  ('e0000000-0000-0000-0000-00000000000e', 'c0000000-0000-0000-0000-00000000000c', 'Sub 1L', 1, 'L', 2.99, 50, false);

select public.create_order(
  'a0000000-0000-0000-0000-00000000000a'::uuid,
  'b0000000-0000-0000-0000-00000000000b'::uuid,
  'Flat 1, Mumbai, Maharashtra 400001',
  jsonb_build_array(
    jsonb_build_object(
      'product_id', 'c0000000-0000-0000-0000-00000000000c',
      'variant_id', 'd0000000-0000-0000-0000-00000000000d',
      'quantity', 3,
      'unit_price', 2.99,
      'delivery_type', 'one_time'
    ),
    jsonb_build_object(
      'product_id', 'c0000000-0000-0000-0000-00000000000c',
      'variant_id', 'e0000000-0000-0000-0000-00000000000e',
      'quantity', 1,
      'unit_price', 2.99,
      'delivery_type', 'subscription',
      'subscription_duration_days', 5,
      'subscription_frequency', 'alternate',
      'subscription_start_date', '2026-08-01',
      'discount_percent', 5
    )
  ),
  8.97, 0, 8.97
) as order_id \gset

select is(
  (select count(*)::int from public.orders where id = :'order_id'::uuid),
  1,
  'exactly one order row should be created'
);

select is(
  (select count(*)::int from public.order_items where order_id = :'order_id'::uuid),
  2,
  'two order_items rows should be created'
);

select is(
  (select count(*)::int from public.subscription_deliveries sd
     join public.order_items oi on oi.id = sd.order_item_id
     where oi.order_id = :'order_id'::uuid),
  5,
  'the subscription item should generate 5 delivery rows'
);

select is(
  (select stock_quantity from public.product_variants where id = 'd0000000-0000-0000-0000-00000000000d'),
  97,
  'a one_time item should decrement stock by its quantity at order creation'
);

select is(
  (select stock_quantity from public.product_variants where id = 'e0000000-0000-0000-0000-00000000000e'),
  50,
  'a subscription item should NOT decrement stock at order creation'
);

select is(
  (select scheduled_date from public.subscription_deliveries sd
     join public.order_items oi on oi.id = sd.order_item_id
     where oi.order_id = :'order_id'::uuid and sd.sequence_number = 1),
  '2026-08-01'::date,
  'the first subscription delivery should be scheduled on the requested start date'
);

select is(
  (select scheduled_date from public.subscription_deliveries sd
     join public.order_items oi on oi.id = sd.order_item_id
     where oi.order_id = :'order_id'::uuid and sd.sequence_number = 5),
  '2026-08-09'::date,
  'the fifth alternate-day delivery should be spaced 2 days apart (start + 8 days)'
);

select * from finish();
rollback;
