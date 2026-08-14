-- The fallback tier: the only location signal available for an address the
-- user was never physically standing at.
--
-- A pincode maps to exactly one hub. Where a pincode straddles two, assigning
-- it to either is fine -- hub assignment feeds future routing, not the
-- accept/reject verdict.
create table public.serviceable_pincodes (
  pincode text primary key,
  zone_id uuid not null references public.delivery_zones (id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.serviceable_pincodes enable row level security;

-- Same shape as delivery_zones: readable by all, writable only via migration
-- or service_role.
create policy serviceable_pincodes_select_all on public.serviceable_pincodes
  for select to anon, authenticated using (true);
