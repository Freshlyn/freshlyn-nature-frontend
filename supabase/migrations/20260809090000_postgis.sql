-- Serviceability is decided by point-in-polygon containment against hub
-- coverage areas, so the geometry types and ST_Contains have to exist before
-- delivery_zones can declare its `area` column.
--
-- PostGIS is included free on every Supabase plan. A handful of polygons is
-- kilobytes and an indexed containment query is sub-millisecond, so this adds
-- no recurring cost.
create extension if not exists postgis;
