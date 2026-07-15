begin;
select plan(5);

select has_table('public', 'subscription_configs', 'subscription_configs table should exist');
select has_table('public', 'subscription_durations', 'subscription_durations table should exist');

insert into public.products (id, name, category, unit) values
  ('c1111111-1111-1111-1111-111111111111', 'Sub Config Product', 'dairy', 'L');

select throws_ok(
  $$ insert into public.subscription_configs (product_id, enabled, frequencies)
     values ('c1111111-1111-1111-1111-111111111111', true, array['weekly']) $$,
  '23514',
  null,
  'frequencies should reject a value outside {daily,alternate,every_3rd}'
);

insert into public.subscription_configs (product_id, enabled, frequencies)
values ('c1111111-1111-1111-1111-111111111111', true, array['daily','alternate']);

insert into public.subscription_durations (product_id, duration_days, label, discount_percent)
values ('c1111111-1111-1111-1111-111111111111', 30, '30 Deliveries', 10);

select throws_ok(
  $$ insert into public.subscription_durations (product_id, duration_days, label, discount_percent)
     values ('c1111111-1111-1111-1111-111111111111', 30, 'Duplicate', 5) $$,
  '23505',
  null,
  'a duplicate (product_id, duration_days) pair should violate the unique constraint'
);

delete from public.subscription_configs where product_id = 'c1111111-1111-1111-1111-111111111111';

select is(
  (select count(*)::int from public.subscription_durations where product_id = 'c1111111-1111-1111-1111-111111111111'),
  0,
  'deleting a subscription_configs row should cascade-delete its subscription_durations rows'
);

select * from finish();
rollback;
