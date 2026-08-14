begin;
select plan(14);

-- Two adjacent square zones plus one deactivated one. These fixtures are
-- isolated far from the seeded Kolkata zones to avoid overlap. Nothing here
-- depends on the real seed data -- these are the test's own fixtures.
insert into public.delivery_zones (id, name, area, active) values
  (
    'aaaaaaaa-0000-0000-0000-00000000000a',
    'Zone A',
    st_geomfromgeojson('{"type":"Polygon","coordinates":[[[90.30,22.50],[90.40,22.50],[90.40,22.60],[90.30,22.60],[90.30,22.50]]]}')::geography,
    true
  ),
  (
    'bbbbbbbb-0000-0000-0000-00000000000b',
    'Zone B (inactive)',
    st_geomfromgeojson('{"type":"Polygon","coordinates":[[[90.50,22.50],[90.60,22.50],[90.60,22.60],[90.50,22.60],[90.50,22.50]]]}')::geography,
    false
  );

insert into public.serviceable_pincodes (pincode, zone_id, active) values
  ('700032', 'aaaaaaaa-0000-0000-0000-00000000000a', true),
  ('700099', 'aaaaaaaa-0000-0000-0000-00000000000a', false);

-- 1. A point inside an active zone is serviceable and names its zone.
select is(
  (select serviceable from public.check_serviceability(22.55, 90.35, null)),
  true,
  'a point inside an active zone should be serviceable'
);

select is(
  (select zone_id from public.check_serviceability(22.55, 90.35, null)),
  'aaaaaaaa-0000-0000-0000-00000000000a'::uuid,
  'a point inside a zone should report that zone id'
);

select is(
  (select matched_by from public.check_serviceability(22.55, 90.35, null)),
  'gps',
  'a coordinate-based verdict should be matched_by gps'
);

-- 2. A point outside every zone is rejected.
select is(
  (select serviceable from public.check_serviceability(22.90, 91.90, null)),
  false,
  'a point outside every zone should not be serviceable'
);

-- 3. THE FALL-THROUGH GUARD. This is the single most important assertion in
--    the suite. Coordinates are authoritative: a GPS point outside every
--    polygon is a genuine rejection, and must NOT be rescued by a serviceable
--    pincode sitting on the same address. Without the guard, an out-of-area
--    address carrying pincode 700032 would be approved by the coarse tier
--    after the accurate tier had already rejected it, defeating the polygon
--    entirely.
select is(
  (select serviceable from public.check_serviceability(22.90, 91.90, '700032')),
  false,
  'a GPS rejection must NOT fall through to the pincode tier'
);

select is(
  (select matched_by from public.check_serviceability(22.90, 91.90, '700032')),
  'gps',
  'a GPS rejection should still report matched_by gps, not pincode'
);

-- 4. Null coordinates fall to the pincode tier.
select is(
  (select serviceable from public.check_serviceability(null, null, '700032')),
  true,
  'null coordinates with a listed pincode should be serviceable'
);

select is(
  (select matched_by from public.check_serviceability(null, null, '700032')),
  'pincode',
  'a pincode-based verdict should be matched_by pincode'
);

select is(
  (select serviceable from public.check_serviceability(null, null, '700001')),
  false,
  'null coordinates with an unlisted pincode should not be serviceable'
);

-- 5. Neither input.
select is(
  (select matched_by from public.check_serviceability(null, null, null)),
  'none',
  'no usable input at all should be matched_by none'
);

-- 6. Inactive rows are invisible to both tiers.
select is(
  (select serviceable from public.check_serviceability(22.55, 90.55, null)),
  false,
  'a point inside an INACTIVE zone should not be serviceable'
);

select is(
  (select serviceable from public.check_serviceability(null, null, '700099')),
  false,
  'an INACTIVE listed pincode should not be serviceable'
);

-- Zone A's eastern edge sits at longitude 90.40. A point 0.0001 degrees inside
-- it (~10 metres) must pass, and the same distance outside must fail. This is
-- the assertion that catches an off-by-one in the containment predicate -- for
-- example ST_Touches slipping in, or a lat/lng argument swap that happens to
-- look right for a square zone but is wrong at the edges.
select is(
  (select serviceable from public.check_serviceability(22.55, 90.3999, null)),
  true,
  'a point just INSIDE the zone boundary should be serviceable'
);

select is(
  (select serviceable from public.check_serviceability(22.55, 90.4001, null)),
  false,
  'a point just OUTSIDE the zone boundary should not be serviceable'
);

select * from finish();
rollback;
