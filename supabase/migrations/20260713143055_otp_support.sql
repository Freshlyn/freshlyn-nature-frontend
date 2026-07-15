create table public.otp_codes (
  phone text primary key,
  otp text not null,
  expires_at timestamptz not null
);

alter table public.otp_codes enable row level security;

create function public.fn_get_user_id_by_phone(p_phone text)
returns uuid
language sql
security definer set search_path = public
as $$
  -- GoTrue strips the leading "+" when it writes auth.users.phone, but callers
  -- always pass E.164-formatted numbers (e.g. "+911234567890"); normalize both
  -- sides so the match works regardless of which convention produced the row.
  select id from auth.users where ltrim(phone, '+') = ltrim(p_phone, '+') limit 1;
$$;

revoke execute on function public.fn_get_user_id_by_phone(text) from public;
revoke execute on function public.fn_get_user_id_by_phone(text) from anon;
revoke execute on function public.fn_get_user_id_by_phone(text) from authenticated;
grant execute on function public.fn_get_user_id_by_phone(text) to service_role;
