begin;
select plan(27);

-- Fixtures: a user, an address, and a variant with known stock.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'p@example.com');
insert into public.addresses (id, user_id, label, flat_house, city, state, pincode)
  values ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-0000000000aa', 'Home', 'Flat 1', 'Mumbai', 'MH', '400001');

-- create_order now refuses an address outside every coverage area, so this
-- fixture needs a zone that covers it. Its coordinates are null, so it is
-- pincode-tier and only needs an allowlist entry.
insert into public.delivery_zones (id, name, area) values
  (
    'f2000000-0000-4000-8000-00000000000f',
    'Fixture Zone',
    st_geomfromgeojson('{"type":"Polygon","coordinates":[[[72.80,18.90],[73.00,18.90],[73.00,19.10],[72.80,19.10],[72.80,18.90]]]}')::geography
  );

insert into public.serviceable_pincodes (pincode, zone_id) values
  ('400001', 'f2000000-0000-4000-8000-00000000000f');

-- Stock starts at 100 for this seeded variant.
select is(
  (select stock_quantity from public.product_variants where id = '00000000-0000-0001-0000-000000000002'),
  100,
  'fixture: variant starts with stock 100'
);

-- p_decrement_stock = false leaves stock untouched (the razorpay path)
select public.create_order(
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-0000000000bb',
  'addr',
  '[{"product_id":"00000000-0000-0000-0000-000000000001","variant_id":"00000000-0000-0001-0000-000000000002","quantity":3,"unit_price":2.99,"delivery_type":"one_time"}]'::jsonb,
  8.97, 5.0, 13.97, false
) as razorpay_order_id \gset

select is(
  (select stock_quantity from public.product_variants where id = '00000000-0000-0001-0000-000000000002'),
  100,
  'create_order with p_decrement_stock=false must NOT move stock'
);

select is(
  (select payment_status from public.orders where id = :'razorpay_order_id'),
  'pending'::public.payment_status,
  'a new order starts pending'
);

-- F2: create_order must be able to write payment_method in the SAME insert.
-- A follow-up UPDATE would leave the row briefly at the column default 'cod',
-- and a concurrent razorpay checkout's supersede sweep (which filters on
-- payment_method = 'razorpay') would miss it -- two live payable orders, stock
-- decremented twice.
select public.create_order(
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-0000000000bb',
  'addr',
  '[{"product_id":"00000000-0000-0000-0000-000000000001","variant_id":"00000000-0000-0001-0000-000000000002","quantity":1,"unit_price":2.99,"delivery_type":"one_time"}]'::jsonb,
  2.99, 5.0, 7.99, false, 'razorpay'
) as method_order \gset

select is(
  (select payment_method from public.orders where id = :'method_order'),
  'razorpay'::public.payment_method,
  'create_order writes p_payment_method on the order row itself'
);

-- The parameter is defaulted, so callers that omit it still land on cod.
select is(
  (select payment_method from public.orders where id = :'razorpay_order_id'),
  'cod'::public.payment_method,
  'create_order defaults payment_method to cod when the argument is omitted'
);

-- confirm_order_payment: marks paid AND performs the deferred decrement
select public.confirm_order_payment(:'razorpay_order_id'::uuid, 'pay_TEST123');

select is(
  (select stock_quantity from public.product_variants where id = '00000000-0000-0001-0000-000000000002'),
  97,
  'confirm_order_payment must decrement stock by the ordered quantity'
);
select is(
  (select payment_status from public.orders where id = :'razorpay_order_id'),
  'paid'::public.payment_status,
  'confirm_order_payment sets paid'
);
select is(
  (select payment_authority from public.orders where id = :'razorpay_order_id'),
  'webhook',
  'confirm_order_payment stamps webhook authority'
);
select is(
  (select status from public.orders where id = :'razorpay_order_id'),
  'confirmed'::public.order_status,
  'confirm_order_payment advances status to confirmed'
);

-- C2: the client may NOT overwrite a webhook decision.
select is(
  public.client_mark_paid(:'razorpay_order_id'::uuid, 'pay_OTHER'),
  false,
  'client_mark_paid must no-op once the webhook has stamped authority'
);

-- Finding 4: prove the no-op above left the row untouched, not just that it
-- returned false.
select is(
  (select razorpay_payment_id from public.orders where id = :'razorpay_order_id'),
  'pay_TEST123',
  'client_mark_paid must not overwrite razorpay_payment_id once webhook has spoken'
);
select is(
  (select payment_authority from public.orders where id = :'razorpay_order_id'),
  'webhook',
  'client_mark_paid must not overwrite payment_authority once webhook has spoken'
);

-- C1: the webhook MAY overwrite a client decision.
select public.create_order(
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-0000000000bb',
  'addr',
  '[{"product_id":"00000000-0000-0000-0000-000000000001","variant_id":"00000000-0000-0001-0000-000000000002","quantity":1,"unit_price":2.99,"delivery_type":"one_time"}]'::jsonb,
  2.99, 5.0, 7.99, false
) as second_order \gset

select is(
  public.client_mark_paid(:'second_order'::uuid, 'pay_CLIENT'),
  true,
  'client_mark_paid succeeds on a blank authority'
);

select public.fail_order_payment(:'second_order'::uuid, 'pay_CLIENT');
select is(
  (select payment_status from public.orders where id = :'second_order'),
  'failed'::public.payment_status,
  'the webhook must be able to overwrite a client-set paid to failed'
);

-- Finding 3: C1 must also hold for confirm_order_payment specifically (the
-- function that also moves stock), not just for fail_order_payment.
select public.create_order(
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-0000000000bb',
  'addr',
  '[{"product_id":"00000000-0000-0000-0000-000000000001","variant_id":"00000000-0000-0001-0000-000000000002","quantity":2,"unit_price":2.99,"delivery_type":"one_time"}]'::jsonb,
  5.98, 5.0, 10.98, false
) as third_order \gset

select public.client_mark_paid(:'third_order'::uuid, 'pay_CLIENT_3');

select public.confirm_order_payment(:'third_order'::uuid, 'pay_WEBHOOK_3');

select is(
  (select payment_status from public.orders where id = :'third_order'),
  'paid'::public.payment_status,
  'confirm_order_payment (C1) overwrites a client-set paid order to paid via webhook'
);
select is(
  (select payment_authority from public.orders where id = :'third_order'),
  'webhook',
  'confirm_order_payment (C1) stamps webhook authority even after a client claim'
);
select is(
  (select stock_quantity from public.product_variants where id = '00000000-0000-0001-0000-000000000002'),
  95,
  'confirm_order_payment (C1) still performs the deferred decrement after a client claim'
);

-- Finding 1: two one_time items sharing the same variant_id must both be
-- decremented -- UPDATE ... FROM joins each target row at most once, so a
-- naive join would silently drop one of the two quantities.
select public.create_order(
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-0000000000bb',
  'addr',
  '[{"product_id":"00000000-0000-0000-0000-000000000001","variant_id":"00000000-0000-0001-0000-000000000002","quantity":1,"unit_price":2.99,"delivery_type":"one_time"},{"product_id":"00000000-0000-0000-0000-000000000001","variant_id":"00000000-0000-0001-0000-000000000002","quantity":3,"unit_price":2.99,"delivery_type":"one_time"}]'::jsonb,
  11.96, 5.0, 16.96, false
) as dup_variant_order \gset

select public.confirm_order_payment(:'dup_variant_order'::uuid, 'pay_DUP');

select is(
  (select stock_quantity from public.product_variants where id = '00000000-0000-0001-0000-000000000002'),
  91,
  'confirm_order_payment must sum quantities across order_items sharing a variant_id'
);

-- Finding 2: confirm_order_payment must be idempotent -- Razorpay retries the
-- same captured event, and the webhook route's own dedup insert is a separate
-- statement from this RPC, not the same transaction.
select public.confirm_order_payment(:'dup_variant_order'::uuid, 'pay_DUP');

select is(
  (select stock_quantity from public.product_variants where id = '00000000-0000-0001-0000-000000000002'),
  91,
  'confirm_order_payment must not re-decrement stock when called twice for the same order'
);

-- Regression: a payment.failed followed by a payment.captured on the SAME
-- razorpay order must still capture. fail_order_payment stamps authority
-- 'webhook', so an authority-scoped idempotency guard would swallow the
-- retry -- money taken, order left failed, payment id pointing at the failed
-- attempt, no stock reserved. The guard is scoped to a completed capture
-- (paid + webhook) precisely so failure stays non-terminal.
select public.create_order(
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-0000000000bb',
  'addr',
  '[{"product_id":"00000000-0000-0000-0000-000000000001","variant_id":"00000000-0000-0001-0000-000000000002","quantity":4,"unit_price":2.99,"delivery_type":"one_time"}]'::jsonb,
  11.96, 5.0, 16.96, false
) as retry_order \gset

select public.fail_order_payment(:'retry_order'::uuid, 'pay_ATTEMPT1');
select public.confirm_order_payment(:'retry_order'::uuid, 'pay_ATTEMPT2');

select is(
  (select payment_status from public.orders where id = :'retry_order'),
  'paid'::public.payment_status,
  'confirm_order_payment must still capture after a prior fail_order_payment'
);
select is(
  (select payment_authority from public.orders where id = :'retry_order'),
  'webhook',
  'the retried capture keeps webhook authority'
);
select is(
  (select razorpay_payment_id from public.orders where id = :'retry_order'),
  'pay_ATTEMPT2',
  'the retried capture records the CAPTURED payment id, not the failed attempt'
);
select is(
  (select stock_quantity from public.product_variants where id = '00000000-0000-0001-0000-000000000002'),
  87,
  'the retried capture performs the deferred decrement (91 - 4)'
);

-- F3: the SYMMETRIC ordering -- a payment.captured followed by a LATE, retried
-- payment.failed for an earlier attempt. Razorpay does not guarantee event
-- ordering and its retries reorder freely, and the payment_events dedup does not
-- help here because the two events differ in event_type and both pass the unique
-- key by design. Without a guard, fail_order_payment would flip a settled order
-- to 'failed' while the stock stays decremented and the money stays captured.
select public.create_order(
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-0000000000bb',
  'addr',
  '[{"product_id":"00000000-0000-0000-0000-000000000001","variant_id":"00000000-0000-0001-0000-000000000002","quantity":2,"unit_price":2.99,"delivery_type":"one_time"}]'::jsonb,
  5.98, 5.0, 10.98, false, 'razorpay'
) as late_fail_order \gset

select public.confirm_order_payment(:'late_fail_order'::uuid, 'pay_CAPTURED');
select public.fail_order_payment(:'late_fail_order'::uuid, 'pay_LATE_FAILED');

select is(
  (select payment_status from public.orders where id = :'late_fail_order'),
  'paid'::public.payment_status,
  'a late payment.failed must NOT overwrite a webhook-confirmed capture'
);
select is(
  (select razorpay_payment_id from public.orders where id = :'late_fail_order'),
  'pay_CAPTURED',
  'the late failure must not repoint razorpay_payment_id at the failed attempt'
);
select is(
  (select stock_quantity from public.product_variants where id = '00000000-0000-0001-0000-000000000002'),
  85,
  'the late failure leaves the decremented stock alone (87 - 2)'
);

-- C1 still holds: the guard is scoped to (paid + webhook), so a CLIENT-set paid
-- remains overwritable by the webhook's failure path. Without this, scoping the
-- guard to payment_status alone would strand client-optimistic rows as paid.
select public.create_order(
  '00000000-0000-0000-0000-0000000000aa',
  '00000000-0000-0000-0000-0000000000bb',
  'addr',
  '[{"product_id":"00000000-0000-0000-0000-000000000001","variant_id":"00000000-0000-0001-0000-000000000002","quantity":1,"unit_price":2.99,"delivery_type":"one_time"}]'::jsonb,
  2.99, 5.0, 7.99, false, 'razorpay'
) as client_paid_order \gset

select public.client_mark_paid(:'client_paid_order'::uuid, 'pay_CLIENT_LATE');
select public.fail_order_payment(:'client_paid_order'::uuid, 'pay_WEBHOOK_FAIL');

select is(
  (select payment_status from public.orders where id = :'client_paid_order'),
  'failed'::public.payment_status,
  'the F3 guard does not block the webhook from failing a CLIENT-set paid order (C1)'
);

select * from finish();
rollback;
