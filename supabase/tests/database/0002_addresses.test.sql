begin;
select plan(5);

select has_table('public', 'addresses', 'addresses table should exist');

insert into auth.users (id, phone, email) values
  ('21111111-1111-1111-1111-111111111111', '+910000000001', 'addr-a@example.com');

insert into public.addresses (id, user_id, label, flat_house, city, state, pincode, is_default) values
  ('22222222-2222-2222-2222-222222222222', '21111111-1111-1111-1111-111111111111', 'Home', 'Flat 4B', 'Mumbai', 'Maharashtra', '400001', true),
  ('23333333-3333-3333-3333-333333333333', '21111111-1111-1111-1111-111111111111', 'Work', 'Office 12', 'Mumbai', 'Maharashtra', '400002', false);

select throws_ok(
  $$ update public.addresses set is_default = true where id = '23333333-3333-3333-3333-333333333333' $$,
  '23505',
  null,
  'directly setting a second default address should violate the partial unique index'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '21111111-1111-1111-1111-111111111111', true);

select public.set_default_address('23333333-3333-3333-3333-333333333333');

select is(
  (select is_default from public.addresses where id = '23333333-3333-3333-3333-333333333333'),
  true,
  'set_default_address should mark the given address as default'
);

select is(
  (select is_default from public.addresses where id = '22222222-2222-2222-2222-222222222222'),
  false,
  'set_default_address should unset the previous default address'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$ select public.set_default_address('22222222-2222-2222-2222-222222222222') $$,
  'P0001',
  'not authenticated',
  'set_default_address should reject calls with no authenticated user'
);

select * from finish();
rollback;
