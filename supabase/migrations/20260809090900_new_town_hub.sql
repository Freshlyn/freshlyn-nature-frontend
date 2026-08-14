-- Add a New Town / Rajarhat hub and put pincode 700157 on the allowlist.
--
-- Why a new zone rather than stretching Salt Lake: New Town sits east of the
-- Salt Lake polygon's edge at longitude 88.445. A real address there was
-- landing within ~175 m of that edge, which is inside GPS noise -- a fix
-- accurate to 50-100 m could put the same doorstep on either side of the
-- boundary depending on the reading. Widening Salt Lake to cover it would also
-- make one hub responsible for a much larger area than a rider can serve,
-- which defeats the point of drawing boundaries by rider reach.
--
-- 700157 was NOT in the original seed allowlist at all, so before this
-- migration a New Town address failed the pincode tier outright.
--
-- Coverage: roughly 22.575-22.650 N, 88.435-88.520 E -- about 8 km east-west
-- by 8 km north-south around Rajarhat / New Town Action Areas I-III. Chosen so
-- the whole neighbourhood is served rather than a single point, and so the
-- pincode tier and the GPS tier AGREE for 700157: a typed address and a
-- "Yes, I'm here" address now reach the same verdict. That agreement is the
-- property that prevents the tier-upgrade lockout the reconcile migration
-- (20260809090800) had to clean up for four other pincodes.
--
-- PLACEHOLDER GEOMETRY, like the other three hubs. Replace with the real
-- rider-reach boundary before launch: draw it on https://geojson.io, copy the
-- feature's `geometry` object, and issue an `update ... where id = ...` in a
-- NEW migration. Never edit this file once applied.
--
-- GeoJSON coordinate order is [longitude, latitude] -- every pair below reads
-- [88.x, 22.x]. Reversing them puts the polygon in the Indian Ocean and the
-- only symptom is that every address silently rejects.
insert into public.delivery_zones (id, name, area) values
  (
    'd0000000-0000-4000-8000-000000000004',
    'New Town Hub',
    st_geomfromgeojson('{"type":"Polygon","coordinates":[[[88.435,22.575],[88.520,22.575],[88.520,22.650],[88.435,22.650],[88.435,22.575]]]}')::geography
  );

-- 700157 covers New Town / Rajarhat and is mostly inside the polygon above,
-- which is the curation rule the README states for this table.
insert into public.serviceable_pincodes (pincode, zone_id) values
  ('700157', 'd0000000-0000-4000-8000-000000000004');
