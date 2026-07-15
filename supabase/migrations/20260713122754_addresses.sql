create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  flat_house text not null,
  building text,
  street text,
  landmark text,
  city text not null,
  state text not null,
  pincode text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index addresses_one_default_per_user
  on public.addresses (user_id)
  where is_default;

create function public.set_default_address(p_address_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_owner uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select user_id into v_owner from public.addresses where id = p_address_id;

  if v_owner is null then
    raise exception 'address not found';
  end if;

  if v_owner <> auth.uid() then
    raise exception 'not authorized';
  end if;

  update public.addresses set is_default = false where user_id = auth.uid();
  update public.addresses set is_default = true where id = p_address_id;
end;
$$;
