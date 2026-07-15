begin;
select plan(8);

insert into auth.users (id, phone, email) values
  ('e0000000-0000-0000-0000-000000000001', '+910000000031', 'trig-a@example.com');

insert into public.products (id, name, category, unit) values
  ('e0000000-0000-0000-0000-000000000002', 'Trigger Milk', 'dairy', 'L');

insert into public.product_variants (id, product_id, name, quantity_value, quantity_unit, price, stock_quantity, is_default) values
  ('e0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000002', '1L', 1, 'L', 2.99, 10, true),
  ('e0000000-0000-0000-0000-000000000004', 'e0000000-0000-0000-0000-000000000002', '2L Low Stock', 2, 'L', 4.99, 2, false);

-- Order A: skip/cancel makeup-delivery behavior
insert into public.orders (id, user_id, delivery_address, subtotal, delivery_fee, total, item_count) values
  ('e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000001', 'Test Address', 2.99, 0, 2.99, 1);

insert into public.order_items (id, order_id, product_id, variant_id, quantity, unit_price, delivery_type, subscription_duration_days, subscription_frequency) values
  ('e0000000-0000-0000-0000-000000000006', 'e0000000-0000-0000-0000-000000000005', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 1, 2.99, 'subscription', 3, 'daily');

insert into public.subscription_deliveries (id, order_item_id, sequence_number, scheduled_date, status) values
  ('e0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000006', 1, '2026-08-01', 'scheduled'),
  ('e0000000-0000-0000-0000-000000000008', 'e0000000-0000-0000-0000-000000000006', 2, '2026-08-02', 'scheduled'),
  ('e0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-000000000006', 3, '2026-08-03', 'scheduled');

update public.subscription_deliveries set status = 'skipped' where id = 'e0000000-0000-0000-0000-000000000007';

select is(
  (select count(*)::int from public.subscription_deliveries where order_item_id = 'e0000000-0000-0000-0000-000000000006'),
  4,
  'skipping a delivery should append exactly one makeup row'
);

select is(
  (select scheduled_date from public.subscription_deliveries where order_item_id = 'e0000000-0000-0000-0000-000000000006' and sequence_number = 4),
  '2026-08-04'::date,
  'the makeup row should be dated one daily interval after the current max scheduled_date'
);

update public.subscription_deliveries set status = 'cancelled' where id = 'e0000000-0000-0000-0000-000000000008';

select is(
  (select count(*)::int from public.subscription_deliveries where order_item_id = 'e0000000-0000-0000-0000-000000000006'),
  4,
  'cancelling a delivery should not append a makeup row'
);

select is(
  (select stock_quantity from public.product_variants where id = 'e0000000-0000-0000-0000-000000000003'),
  10,
  'skipping/cancelling deliveries should not touch stock_quantity'
);

-- Order B: fn_maybe_complete_order gating
insert into public.orders (id, user_id, delivery_address, subtotal, delivery_fee, total, item_count) values
  ('e000000b-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-000000000001', 'Test Address', 2.99, 0, 2.99, 1);

insert into public.order_items (id, order_id, product_id, variant_id, quantity, unit_price, delivery_type, subscription_duration_days, subscription_frequency) values
  ('e000000b-0000-0000-0000-00000000000c', 'e000000b-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003', 1, 2.99, 'subscription', 2, 'daily');

insert into public.subscription_deliveries (id, order_item_id, sequence_number, scheduled_date, status) values
  ('e000000b-0000-0000-0000-00000000000d', 'e000000b-0000-0000-0000-00000000000c', 1, '2026-08-01', 'scheduled'),
  ('e000000b-0000-0000-0000-00000000000e', 'e000000b-0000-0000-0000-00000000000c', 2, '2026-08-02', 'scheduled');

update public.subscription_deliveries set status = 'delivered' where id = 'e000000b-0000-0000-0000-00000000000d';

select isnt(
  (select status from public.orders where id = 'e000000b-0000-0000-0000-00000000000b'),
  'delivered',
  'order should stay non-delivered while a subscription delivery is still outstanding'
);

update public.subscription_deliveries set status = 'delivered' where id = 'e000000b-0000-0000-0000-00000000000e';

select is(
  (select status from public.orders where id = 'e000000b-0000-0000-0000-00000000000b'),
  'delivered',
  'order should flip to delivered once every subscription delivery for it is delivered'
);

select is(
  (select stock_quantity from public.product_variants where id = 'e0000000-0000-0000-0000-000000000003'),
  8,
  'each delivered transition should decrement stock_quantity by the order_item quantity (10 - 1 - 1 = 8)'
);

-- Order C: negative stock allowed without error
insert into public.orders (id, user_id, delivery_address, subtotal, delivery_fee, total, item_count) values
  ('e000000c-0000-0000-0000-00000000000f', 'e0000000-0000-0000-0000-000000000001', 'Test Address', 4.99, 0, 4.99, 1);

insert into public.order_items (id, order_id, product_id, variant_id, quantity, unit_price, delivery_type, subscription_duration_days, subscription_frequency) values
  ('e000000c-0000-0000-0000-000000000010', 'e000000c-0000-0000-0000-00000000000f', 'e0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004', 5, 4.99, 'subscription', 1, 'daily');

insert into public.subscription_deliveries (id, order_item_id, sequence_number, scheduled_date, status) values
  ('e000000c-0000-0000-0000-000000000011', 'e000000c-0000-0000-0000-000000000010', 1, '2026-08-01', 'scheduled');

update public.subscription_deliveries set status = 'delivered' where id = 'e000000c-0000-0000-0000-000000000011';

select is(
  (select stock_quantity from public.product_variants where id = 'e0000000-0000-0000-0000-000000000004'),
  -3,
  'decrementing stock below zero should succeed without error (2 - 5 = -3)'
);

select * from finish();
rollback;
