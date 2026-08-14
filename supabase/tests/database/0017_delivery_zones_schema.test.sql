begin;
select plan(18);

select is(
  (select count(*)::int from pg_extension where extname = 'postgis'),
  1,
  'the postgis extension should be installed'
);

select has_table('public', 'delivery_zones', 'delivery_zones should exist');
select has_table('public', 'serviceable_pincodes', 'serviceable_pincodes should exist');

select has_index(
  'public', 'delivery_zones', 'delivery_zones_area_idx',
  'delivery_zones.area should have a GiST index for containment lookups'
);

select is(
  (select amname from pg_class c
     join pg_index i on i.indexrelid = c.oid
     join pg_am am on am.oid = c.relam
    where c.relname = 'delivery_zones_area_idx'),
  'gist',
  'the area index should be GiST, not btree -- btree cannot answer ST_Contains'
);

-- A zone is born active so a freshly seeded polygon serves immediately.
insert into public.delivery_zones (id, name, area)
values (
  '11111111-1111-1111-1111-111111111111',
  'Test Zone',
  st_geomfromgeojson('{"type":"Polygon","coordinates":[[[88.3,22.5],[88.4,22.5],[88.4,22.6],[88.3,22.6],[88.3,22.5]]]}')::geography
);

select is(
  (select active from public.delivery_zones where id = '11111111-1111-1111-1111-111111111111'),
  true,
  'a new delivery zone should default to active'
);

insert into public.serviceable_pincodes (pincode, zone_id)
values ('700032', '11111111-1111-1111-1111-111111111111');

select is(
  (select active from public.serviceable_pincodes where pincode = '700032'),
  true,
  'a new serviceable pincode should default to active'
);

-- Readable by everyone, writable by nobody but service_role/migrations. The
-- polygons are not secret; the ability to redraw them is.
set local role authenticated;
select is(
  (select count(*)::int from public.delivery_zones where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'an authenticated user should be able to read delivery zones'
);

select throws_ok(
  $$ insert into public.delivery_zones (name, area)
     values ('Rogue Zone', st_geomfromgeojson('{"type":"Polygon","coordinates":[[[0,0],[1,0],[1,1],[0,1],[0,0]]]}')::geography) $$,
  '42501',
  null,
  'an authenticated user should not be able to insert a delivery zone'
);
reset role;

-- Nullability is load-bearing: it is what encodes the tier. An address with
-- coordinates is GPS-tier, one without is pincode-tier. Making these NOT NULL
-- would make it impossible to save an address the user is not standing at.
select col_is_null('public', 'addresses', 'latitude', 'addresses.latitude should be nullable');
select col_is_null('public', 'addresses', 'longitude', 'addresses.longitude should be nullable');

select col_type_is('public', 'addresses', 'latitude', 'double precision', 'latitude should be double precision');
select col_type_is('public', 'addresses', 'longitude', 'double precision', 'longitude should be double precision');

select has_table('public', 'waitlist_signups', 'waitlist_signups should exist');

-- Remove the test fixtures before checking seed counts, so the seed assertion
-- counts only the seeded zones, not the test zone.
delete from public.serviceable_pincodes where pincode = '700032';
delete from public.delivery_zones where id = '11111111-1111-1111-1111-111111111111';

-- The seed is data, but it is data the whole feature depends on: with zero
-- active zones, check_serviceability rejects every GPS-tier address in the
-- system. Assert it exists and is switched on.
select is(
  (select count(*)::int from public.delivery_zones where active),
  3,
  'the seed should install exactly three active hub zones'
);

select ok(
  (select count(*)::int from public.serviceable_pincodes where active) > 0,
  'the seed should install at least one active serviceable pincode'
);

-- Every pincode must point at a zone that actually exists and is on. A
-- pincode wired to a deactivated hub silently rejects every address using it.
select is(
  (select count(*)::int
     from public.serviceable_pincodes sp
     left join public.delivery_zones dz on dz.id = sp.zone_id
    where sp.active and (dz.id is null or not dz.active)),
  0,
  'every active seeded pincode should point at an active zone'
);

-- 20260809090800_reconcile_seeded_pincodes.sql deactivates the four seeded
-- pincodes whose centroid falls outside every placeholder hub polygon, since
-- an active pincode there would let a pincode-tier order succeed while the
-- same address's GPS-tier check_serviceability rejects it -- exactly the
-- mismatch that silently locked out a customer who upgraded via "Confirm
-- location".
select is(
  (select count(*)::int from public.serviceable_pincodes
    where active and pincode in ('700031','700053','700068','700106')),
  0,
  'pincodes outside every hub polygon should be deactivated'
);

select * from finish();
rollback;
