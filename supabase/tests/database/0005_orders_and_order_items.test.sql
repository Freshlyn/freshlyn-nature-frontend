begin;
select plan(4);

select has_table('public', 'orders', 'orders table should exist');
select has_table('public', 'order_items', 'order_items table should exist');

insert into auth.users (id, phone, email) values
  ('d1111111-1111-1111-1111-111111111111', '+910000000021', 'orders-test@example.com');

select throws_ok(
  $$ insert into public.orders (user_id, delivery_address, subtotal, delivery_fee, total, item_count, status)
     values ('d1111111-1111-1111-1111-111111111111', 'Test Address', 10, 0, 10, 1, 'shipped') $$,
  '23514',
  null,
  'orders.status should reject a value outside the defined check constraint'
);

insert into public.orders (id, user_id, delivery_address, subtotal, delivery_fee, total, item_count, created_at, updated_at)
values ('d2222222-2222-2222-2222-222222222222', 'd1111111-1111-1111-1111-111111111111', 'Test Address', 10, 0, 10, 1, '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z');

update public.orders set status = 'confirmed' where id = 'd2222222-2222-2222-2222-222222222222';

select ok(
  (select updated_at from public.orders where id = 'd2222222-2222-2222-2222-222222222222') > '2020-01-01T00:00:00Z'::timestamptz,
  'updating an order should bump updated_at via the trigger'
);

select * from finish();
rollback;
