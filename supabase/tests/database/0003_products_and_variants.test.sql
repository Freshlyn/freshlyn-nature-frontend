begin;
select plan(6);

select has_table('public', 'products', 'products table should exist');
select has_table('public', 'product_variants', 'product_variants table should exist');
select col_is_fk('public', 'product_variants', 'product_id', 'product_variants.product_id should reference products');

insert into public.products (id, name, category, unit) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Persistent Product', 'test', 'unit'),
  ('99999999-9999-9999-9999-999999999999', 'Cascade Test Product', 'test', 'unit');

insert into public.product_variants (id, product_id, name, quantity_value, quantity_unit, price)
values ('88888888-8888-8888-8888-888888888888', '99999999-9999-9999-9999-999999999999', 'Default', 1, 'unit', 1.00);

select is(
  (select max_quantity_per_order from public.product_variants where id = '88888888-8888-8888-8888-888888888888'),
  100,
  'max_quantity_per_order should default to 100 when not specified'
);

delete from public.products where id = '99999999-9999-9999-9999-999999999999';

select is(
  (select count(*)::int from public.product_variants where product_id = '99999999-9999-9999-9999-999999999999'),
  0,
  'deleting a product should cascade-delete its variants'
);

select throws_ok(
  $$ insert into public.product_variants (id, product_id, name, quantity_value, quantity_unit, price, max_quantity_per_order)
     values ('77777777-7777-7777-7777-777777777777', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 1, 'unit', 1.00, null) $$,
  '23502',
  null,
  'max_quantity_per_order should reject an explicit null (NOT NULL constraint)'
);

select * from finish();
rollback;
