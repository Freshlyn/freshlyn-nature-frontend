-- The single verdict function. Every caller -- the app-open screen, the
-- address save flow, the checkout screen, and create_order itself -- asks this
-- one function, so there is exactly one definition of "do we deliver here".
--
-- security definer so anon can call it without being granted direct read
-- access to the zone tables. stable because it only reads.
create function public.check_serviceability(
  p_lat     double precision default null,
  p_lng     double precision default null,
  p_pincode text             default null
) returns table (
  serviceable boolean,
  zone_id     uuid,
  matched_by  text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_zone_id uuid;
begin
  -- Tier 1: coordinates. A single coordinate without its pair is not a usable
  -- position, so both must be present to take this branch; otherwise we fall
  -- to the pincode tier exactly as if neither had been supplied.
  if p_lat is not null and p_lng is not null then
    select dz.id into v_zone_id
    from public.delivery_zones dz
    where dz.active
      and st_contains(
        dz.area::geometry,
        st_setsrid(st_makepoint(p_lng, p_lat), 4326)
      )
    limit 1;

    -- THE FALL-THROUGH GUARD. This returns on rejection as well as on match.
    -- Coordinates are authoritative: a GPS point outside every polygon is a
    -- genuine rejection, not an inconclusive one. Letting it fall through to
    -- the pincode allowlist would let a coarse tier overrule an accurate tier
    -- that had already said no, which defeats the polygon entirely. Do not
    -- "simplify" this into a single fall-through chain.
    return query select (v_zone_id is not null), v_zone_id, 'gps'::text;
    return;
  end if;

  -- Tier 2: pincode. The only signal available for an address the user was
  -- never physically standing at.
  if p_pincode is not null and btrim(p_pincode) <> '' then
    select sp.zone_id into v_zone_id
    from public.serviceable_pincodes sp
    where sp.pincode = btrim(p_pincode)
      and sp.active
    limit 1;

    return query select (v_zone_id is not null), v_zone_id, 'pincode'::text;
    return;
  end if;

  -- No usable input of either kind.
  return query select false, null::uuid, 'none'::text;
end;
$$;

-- anon needs this: the app-open screen runs before login.
grant execute on function public.check_serviceability(double precision, double precision, text) to anon, authenticated;
