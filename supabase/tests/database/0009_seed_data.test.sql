begin;
select plan(5);

select is(
  (select count(*)::int from public.products),
  23,
  'seed data should insert all 23 catalog products'
);

select is(
  (select count(*)::int from public.product_variants),
  60,
  'seed data should insert all 60 product variants'
);

select is(
  (select count(*)::int from public.subscription_configs),
  7,
  'seed data should insert all 7 subscription configs'
);

select is(
  (select count(*)::int from public.subscription_durations),
  28,
  'seed data should insert all 28 subscription duration options (7 products x 15/30/60/90)'
);

select results_eq(
  $$ select price, is_default, max_quantity_per_order from public.product_variants
     where id = '00000000-0000-0001-0000-000000000002' $$,
  $$ values (2.99::numeric(10,2), true, 10) $$,
  'the default 1000ml Milk variant should have the deliberately-lowered max_quantity_per_order of 10'
);

select * from finish();
rollback;
