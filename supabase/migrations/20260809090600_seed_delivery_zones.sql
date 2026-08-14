-- Three hub coverage areas.
--
-- PLACEHOLDER GEOMETRY. These are rough rectangles around Ballygunge, Salt
-- Lake and Behala, sized so the containment path is exercisable end to end.
-- They are NOT the real rider-reach boundaries. To replace them: draw each
-- hub's coverage on https://geojson.io, copy the feature's `geometry` object,
-- and issue an `update public.delivery_zones set area = ... where id = ...`
-- in a NEW migration. Never edit this file after it has been applied.
--
-- GeoJSON coordinate order is [longitude, latitude] -- the opposite of how
-- everyone says "22.53, 88.36". Getting this backwards puts every Kolkata
-- polygon somewhere in the Indian Ocean, and the symptom is that every address
-- is rejected with no error.
--
-- The ids are fixed rather than generated so a later migration can update a
-- specific polygon by id without matching on a name that might be renamed.
insert into public.delivery_zones (id, name, area) values
  (
    'd0000000-0000-4000-8000-000000000001',
    'Ballygunge Hub',
    st_geomfromgeojson('{"type":"Polygon","coordinates":[[[88.340,22.505],[88.400,22.505],[88.400,22.555],[88.340,22.555],[88.340,22.505]]]}')::geography
  ),
  (
    'd0000000-0000-4000-8000-000000000002',
    'Salt Lake Hub',
    st_geomfromgeojson('{"type":"Polygon","coordinates":[[[88.395,22.565],[88.445,22.565],[88.445,22.615],[88.395,22.615],[88.395,22.565]]]}')::geography
  ),
  (
    'd0000000-0000-4000-8000-000000000003',
    'Behala Hub',
    st_geomfromgeojson('{"type":"Polygon","coordinates":[[[88.290,22.470],[88.340,22.470],[88.340,22.520],[88.290,22.520],[88.290,22.470]]]}')::geography
  );

-- The fallback allowlist. A pincode belongs here only when it is MOSTLY inside
-- one of the polygons above: a failed delivery costs a refund, a wasted rider
-- trip and customer trust, while a missed order costs one order. The asymmetry
-- says be conservative.
--
-- A pincode straddling two hubs is assigned to either -- the hub only feeds
-- future routing, never the accept/reject verdict.
--
-- PLACEHOLDER LIST. Tune it once real demand data arrives, in a new migration.
insert into public.serviceable_pincodes (pincode, zone_id) values
  ('700019', 'd0000000-0000-4000-8000-000000000001'),  -- Ballygunge
  ('700029', 'd0000000-0000-4000-8000-000000000001'),  -- Lake Market
  ('700031', 'd0000000-0000-4000-8000-000000000001'),  -- Dhakuria
  ('700068', 'd0000000-0000-4000-8000-000000000001'),  -- Jodhpur Park
  ('700064', 'd0000000-0000-4000-8000-000000000002'),  -- Salt Lake Sector III
  ('700091', 'd0000000-0000-4000-8000-000000000002'),  -- Salt Lake Sector I
  ('700106', 'd0000000-0000-4000-8000-000000000002'),  -- New Town
  ('700034', 'd0000000-0000-4000-8000-000000000003'),  -- Behala
  ('700038', 'd0000000-0000-4000-8000-000000000003'),  -- Behala Chowrasta
  ('700053', 'd0000000-0000-4000-8000-000000000003'),  -- Kidderpore
  ('700060', 'd0000000-0000-4000-8000-000000000003');  -- Sarsuna
