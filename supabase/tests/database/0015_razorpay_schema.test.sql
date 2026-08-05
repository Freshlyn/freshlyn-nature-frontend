begin;
select plan(12);

-- New enum value
select has_column('public', 'orders', 'razorpay_order_id', 'orders should have razorpay_order_id');
select has_column('public', 'orders', 'razorpay_payment_id', 'orders should have razorpay_payment_id');
select has_column('public', 'orders', 'payment_authority', 'orders should have payment_authority');
select col_is_null('public', 'orders', 'razorpay_order_id', 'razorpay_order_id must be nullable for COD orders');

-- 'failed' is usable as a payment_status
select lives_ok(
  $$ select 'failed'::public.payment_status $$,
  'payment_status should accept failed'
);

-- payment_authority rejects anything outside the two allowed values
select throws_ok(
  $$ insert into public.orders (user_id, delivery_address, subtotal, delivery_fee, total, item_count, payment_authority)
     values ('00000000-0000-0000-0000-0000000000aa', 'addr', 1, 0, 1, 1, 'bogus') $$,
  '23514',
  null,
  'payment_authority should reject values outside client/webhook'
);

-- payment_events shape
select has_table('public', 'payment_events', 'payment_events table should exist');
select has_column('public', 'payment_events', 'source', 'payment_events should have source');
select has_column('public', 'payment_events', 'event_type', 'payment_events should have event_type');
select col_has_check('public', 'payment_events', 'source', 'source should be constrained');

-- RLS is on with no policies: clients can never read payment events
select is(
  (select relrowsecurity from pg_class where oid = 'public.payment_events'::regclass),
  true,
  'payment_events should have RLS enabled'
);
select is(
  (select count(*)::int from pg_policies where tablename = 'payment_events'),
  0,
  'payment_events should have no policies (service_role only)'
);

select * from finish();
rollback;
