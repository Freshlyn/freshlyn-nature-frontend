begin;
select plan(8);

select has_table('public', 'otp_codes', 'otp_codes table should exist');
select col_is_pk('public', 'otp_codes', 'phone', 'otp_codes.phone should be the primary key');

insert into auth.users (id, phone, email) values
  ('f1111111-1111-1111-1111-111111111111', '+910000000041', 'otp-lookup@example.com');

insert into public.otp_codes (phone, otp, expires_at) values
  ('+910000000041', '123456', now() + interval '5 minutes');

select is(
  public.fn_get_user_id_by_phone('+910000000041'),
  'f1111111-1111-1111-1111-111111111111'::uuid,
  'fn_get_user_id_by_phone should return the matching auth.users id'
);

select is(
  public.fn_get_user_id_by_phone('+919999999999'),
  null,
  'fn_get_user_id_by_phone should return null for an unregistered phone'
);

set local role authenticated;

select throws_ok(
  $$ select public.fn_get_user_id_by_phone('+910000000041') $$,
  '42501',
  null,
  'fn_get_user_id_by_phone should reject calls from the authenticated role (service_role only)'
);

select is(
  (select count(*)::int from public.otp_codes),
  0,
  'RLS with no policies should hide every otp_codes row from the authenticated role'
);

reset role;

set local role anon;
select throws_ok(
  $$ select public.fn_get_user_id_by_phone('+910000000041') $$,
  '42501',
  null,
  'fn_get_user_id_by_phone should reject calls from the anon role (service_role only)'
);
reset role;

select col_has_default('public', 'otp_codes', 'attempts', 'otp_codes.attempts should default to 0');

select * from finish();
rollback;
