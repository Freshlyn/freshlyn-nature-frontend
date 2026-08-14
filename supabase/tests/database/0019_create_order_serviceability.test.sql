begin;
select plan(6);

insert into auth.users (id, phone, email) values
  ('f0000000-0000-0000-0000-00000000000f', '+912222222222', 'geo-buyer@example.com');

insert into public.delivery_zones (id, name, area) values
  (
    'e1000000-0000-4000-8000-00000000000e',
    'Geo Test Zone',
    st_geomfromgeojson('{"type":"Polygon","coordinates":[[[88.30,22.50],[88.40,22.50],[88.40,22.60],[88.30,22.60],[88.30,22.50]]]}')::geography
  );

insert into public.serviceable_pincodes (pincode, zone_id) values
  ('700032', 'e1000000-0000-4000-8000-00000000000e');

-- Three addresses, one per tier outcome.
insert into public.addresses (id, user_id, label, flat_house, city, state, pincode, latitude, longitude, is_default) values
  -- GPS-tier, inside the zone.
  ('a1000000-0000-4000-8000-00000000000a', 'f0000000-0000-0000-0000-00000000000f', 'Home', 'Flat 1', 'Kolkata', 'West Bengal', '700032', 22.55, 88.35, true),
  -- GPS-tier, far outside every zone, but carrying a LISTED pincode. This is
  -- the fall-through guard reaching create_order.
  ('a2000000-0000-4000-8000-00000000000a', 'f0000000-0000-0000-0000-00000000000f', 'Far', 'Flat 2', 'Chennai', 'Tamil Nadu', '700032', 13.08, 80.27, false),
  -- Pincode-tier, unlisted pincode.
  ('a3000000-0000-4000-8000-00000000000a', 'f0000000-0000-0000-0000-00000000000f', 'Other', 'Flat 3', 'Mumbai', 'Maharashtra', '400001', null, null, false);

insert into public.products (id, name, category, unit) values
  ('c1000000-0000-4000-8000-00000000000c', 'Geo Milk', 'dairy', 'L');

insert into public.product_variants (id, product_id, name, quantity_value, quantity_unit, price, stock_quantity, is_default) values
  ('b1000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-00000000000c', '1L', 1, 'L', 50, 100, true),
  ('b2000000-0000-4000-8000-00000000000b', 'c1000000-0000-4000-8000-00000000000c', 'Sub 1L', 1, 'L', 50, 80, false);

-- A serviceable address still works exactly as before.
select lives_ok(
  $$ select public.create_order(
       'f0000000-0000-0000-0000-00000000000f'::uuid,
       'a1000000-0000-4000-8000-00000000000a'::uuid,
       'Flat 1, Kolkata, West Bengal 700032',
       jsonb_build_array(jsonb_build_object(
         'product_id', 'c1000000-0000-4000-8000-00000000000c',
         'variant_id', 'b1000000-0000-4000-8000-00000000000b',
         'quantity', 2, 'unit_price', 50, 'delivery_type', 'one_time')),
       100, 0, 100) $$,
  'an order to a GPS-tier address inside a zone should be created'
);

select is(
  (select stock_quantity from public.product_variants where id = 'b1000000-0000-4000-8000-00000000000b'),
  98,
  'a serviceable order should still decrement stock as before'
);

-- The out-of-area GPS address with a listed pincode must be rejected. If the
-- guard were missing, the pincode would rescue it here.
select throws_ok(
  $$ select public.create_order(
       'f0000000-0000-0000-0000-00000000000f'::uuid,
       'a2000000-0000-4000-8000-00000000000a'::uuid,
       'Flat 2, Chennai, Tamil Nadu 700032',
       jsonb_build_array(jsonb_build_object(
         'product_id', 'c1000000-0000-4000-8000-00000000000c',
         'variant_id', 'b1000000-0000-4000-8000-00000000000b',
         'quantity', 1, 'unit_price', 50, 'delivery_type', 'one_time')),
       50, 0, 50) $$,
  'P0001',
  'address not serviceable',
  'an out-of-area GPS address should be rejected even with a listed pincode'
);

-- Rejection must leave NO residue. The raise happens before the insert, so the
-- statement-level rollback has nothing to undo -- but assert it, because a
-- check placed after the insert would still pass a throws_ok and silently
-- leave orphaned stock movement in a caller that traps the exception.
select is(
  (select count(*)::int from public.orders where address_id = 'a2000000-0000-4000-8000-00000000000a'),
  0,
  'a rejected order should leave no order row'
);

select is(
  (select stock_quantity from public.product_variants where id = 'b1000000-0000-4000-8000-00000000000b'),
  98,
  'a rejected order should not decrement stock'
);

-- A pincode-tier address whose pincode is not on the list is rejected too, and
-- generates no subscription_deliveries.
select throws_ok(
  $$ select public.create_order(
       'f0000000-0000-0000-0000-00000000000f'::uuid,
       'a3000000-0000-4000-8000-00000000000a'::uuid,
       'Flat 3, Mumbai, Maharashtra 400001',
       jsonb_build_array(jsonb_build_object(
         'product_id', 'c1000000-0000-4000-8000-00000000000c',
         'variant_id', 'b2000000-0000-4000-8000-00000000000b',
         'quantity', 1, 'unit_price', 50, 'delivery_type', 'subscription',
         'subscription_duration_days', 7, 'subscription_frequency', 'daily')),
       350, 0, 350) $$,
  'P0001',
  'address not serviceable',
  'a subscription order to an unlisted pincode should be rejected'
);

select * from finish();
rollback;
