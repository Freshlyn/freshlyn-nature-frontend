begin;
select plan(8);

select has_function(
  'public', 'anonymize_profile', array['uuid'],
  'anonymize_profile function should exist'
);

insert into auth.users (id, phone, email) values
  ('b1000000-0000-0000-0000-000000000001', '+910000000201', 'anon-user@example.com');

insert into public.addresses (id, user_id, label, flat_house, city, state, pincode, is_default) values
  ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Home', 'Flat 1', 'Mumbai', 'Maharashtra', '400001', true);

insert into public.products (id, name, category, unit) values
  ('b3000000-0000-0000-0000-000000000001', 'Anon Milk', 'dairy', 'L');

insert into public.product_variants (id, product_id, name, quantity_value, quantity_unit, price, stock_quantity, is_default) values
  ('b4000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', '1L', 1, 'L', 2.99, 100, true);

insert into public.orders (id, user_id, delivery_address, subtotal, delivery_fee, total, item_count) values
  ('b5000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'Flat 1, Mumbai, Maharashtra 400001', 2.99, 0, 2.99, 1);

insert into public.order_items (id, order_id, product_id, variant_id, quantity, unit_price, delivery_type, subscription_duration_days, subscription_frequency) values
  ('b6000000-0000-0000-0000-000000000001', 'b5000000-0000-0000-0000-000000000001', 'b3000000-0000-0000-0000-000000000001', 'b4000000-0000-0000-0000-000000000001', 1, 2.99, 'subscription', 3, 'daily');

insert into public.subscription_deliveries (id, order_item_id, sequence_number, scheduled_date, status) values
  ('b7000000-0000-0000-0000-000000000001', 'b6000000-0000-0000-0000-000000000001', 1, '2026-09-01', 'delivered'),
  ('b7000000-0000-0000-0000-000000000002', 'b6000000-0000-0000-0000-000000000001', 2, '2026-09-02', 'scheduled'),
  ('b7000000-0000-0000-0000-000000000003', 'b6000000-0000-0000-0000-000000000001', 3, '2026-09-03', 'scheduled');

select public.anonymize_profile('b1000000-0000-0000-0000-000000000001'::uuid);

select results_eq(
  $$ select name, phone, email from public.profiles where id = 'b1000000-0000-0000-0000-000000000001' $$,
  $$ values ('Deleted User'::text, null::text, null::text) $$,
  'anonymize_profile should overwrite the profiles row with placeholder values'
);

select is(
  (select count(*)::int from public.addresses where user_id = 'b1000000-0000-0000-0000-000000000001'),
  0,
  'anonymize_profile should delete every address row for the user'
);

select is(
  (select status from public.subscription_deliveries where id = 'b7000000-0000-0000-0000-000000000002'),
  'cancelled',
  'a scheduled subscription delivery should become cancelled'
);

select is(
  (select count(*)::int from public.subscription_deliveries where order_item_id = 'b6000000-0000-0000-0000-000000000001'),
  3,
  'cancelling scheduled deliveries should not spawn a makeup delivery (still exactly 3 rows)'
);

select is(
  (select status from public.subscription_deliveries where id = 'b7000000-0000-0000-0000-000000000001'),
  'delivered',
  'an already-delivered subscription delivery should be left untouched'
);

select is(
  (select count(*)::int from public.orders where id = 'b5000000-0000-0000-0000-000000000001'),
  1,
  'the order itself should be left untouched by anonymize_profile'
);

set local role authenticated;
select throws_ok(
  $$ select public.anonymize_profile('b1000000-0000-0000-0000-000000000001'::uuid) $$,
  '42501',
  null,
  'anonymize_profile should reject calls from the authenticated role (service_role only)'
);
reset role;

select * from finish();
rollback;
