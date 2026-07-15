create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'flagged', 'completed')),
  cancelled_at timestamptz,
  completed_at timestamptz,
  ip_address text,
  user_agent text
);

create unique index account_deletion_requests_one_active_per_user
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'flagged');

alter table public.account_deletion_requests enable row level security;

create policy account_deletion_requests_select_own on public.account_deletion_requests
  for select using (user_id = auth.uid());

create function public.cancel_account_deletion()
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.account_deletion_requests
  set status = 'cancelled', cancelled_at = now()
  where user_id = auth.uid()
    and status in ('pending', 'flagged');
end;
$$;
