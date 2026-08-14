-- Demand captured from users outside every coverage area. This is the
-- expansion map: it shows where hub #4 belongs.
--
-- Either pincode or the coordinate pair is populated, depending on which
-- signal the user gave on the app-open screen. Both are nullable because only
-- one of the two paths ever runs.
create table public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  pincode text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

alter table public.waitlist_signups enable row level security;

-- Anonymous users reach this table: the app-open screen runs before login.
create policy waitlist_signups_insert_all on public.waitlist_signups
  for insert to anon, authenticated with check (true);

-- Deliberately NO select policy. The rows are phone numbers, and a select
-- policy of any shape would let one user enumerate another's. The list is read
-- through service_role or the Supabase dashboard only.
