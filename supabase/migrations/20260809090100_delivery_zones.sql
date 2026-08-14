-- One row per hub coverage area.
--
-- The boundary follows rider reach, not administrative geography, so it is a
-- drawn polygon rather than a radius: an 8km circle from a Ballygunge hub
-- crosses the Hooghly into Howrah, which is unreachable in practice.
--
-- geography (not geometry) so distances and containment are computed on the
-- spheroid in metres, with SRID 4326 matching the WGS84 coordinates a phone
-- GPS reports.
create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  area geography(Polygon, 4326) not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Containment queries are the whole point of this table and btree cannot
-- answer them. Without GiST every check_serviceability call is a seq scan.
create index delivery_zones_area_idx on public.delivery_zones using gist (area);

alter table public.delivery_zones enable row level security;

-- Read is open: the polygons are not secret, and the client-side advisory
-- checks in the app need them via check_serviceability. There is deliberately
-- NO insert/update/delete policy, so writes are reachable only through a
-- migration or service_role. Zones are edited by developers, not by an admin
-- UI -- that was an explicit non-goal.
create policy delivery_zones_select_all on public.delivery_zones
  for select to anon, authenticated using (true);
