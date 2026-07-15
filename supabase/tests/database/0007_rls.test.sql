begin;
select plan(4);

insert into auth.users (id, phone, email) values
  ('a1111111-1111-1111-1111-111111111111', '+910000000011', 'rls-a@example.com'),
  ('b2222222-2222-2222-2222-222222222222', '+910000000012', 'rls-b@example.com');

insert into public.addresses (id, user_id, label, flat_house, city, state, pincode, is_default) values
  ('a3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 'Home', 'Flat 1', 'Mumbai', 'Maharashtra', '400001', true),
  ('b4444444-4444-4444-4444-444444444444', 'b2222222-2222-2222-2222-222222222222', 'Home', 'Flat 2', 'Pune', 'Maharashtra', '411001', true);

insert into public.orders (id, user_id, delivery_address, subtotal, delivery_fee, total, item_count) values
  ('a5555555-5555-5555-5555-555555555555', 'a1111111-1111-1111-1111-111111111111', 'Flat 1, Mumbai, Maharashtra 400001', 10, 0, 10, 1);

select throws_ok(
  $$ insert into public.addresses (user_id, label, flat_house, city, state, pincode, is_default)
     values ('a1111111-1111-1111-1111-111111111111', 'Work', 'Flat 9', 'Mumbai', 'Maharashtra', '400002', true) $$,
  '23505',
  null,
  'a second default address for the same user should violate the partial unique index'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1111111-1111-1111-1111-111111111111', true);

select is(
  (select count(*)::int from public.addresses where id = 'b4444444-4444-4444-4444-444444444444'),
  0,
  'user A should not be able to select user B''s address row under RLS'
);

select is(
  (select count(*)::int from public.addresses where id = 'a3333333-3333-3333-3333-333333333333'),
  1,
  'user A should be able to select their own address row under RLS'
);

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b2222222-2222-2222-2222-222222222222', true);

select is(
  (select count(*)::int from public.orders where id = 'a5555555-5555-5555-5555-555555555555'),
  0,
  'user B should not be able to select user A''s order row under RLS'
);

reset role;

select * from finish();
rollback;
