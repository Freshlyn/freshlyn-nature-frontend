begin;
select plan(13);

-- Schema shape
select has_table('public', 'otp_send_log', 'otp_send_log table should exist');
select has_table('public', 'otp_throttle_config', 'otp_throttle_config table should exist');
select col_is_null('public', 'otp_codes', 'otp', 'otp_codes.otp should be nullable under AUTOGEN');
select has_column('public', 'otp_codes', 'session_id', 'otp_codes should have session_id');
select has_column('public', 'otp_codes', 'attempts', 'otp_codes should have attempts');

-- Exactly-one-credential constraint
select throws_ok(
  $$ insert into public.otp_codes (phone, otp, session_id, expires_at)
     values ('+919000000001', '123456', 'sess-1', now() + interval '5 minutes') $$,
  '23514',
  null,
  'otp_codes should reject a row with BOTH otp and session_id'
);
select throws_ok(
  $$ insert into public.otp_codes (phone, otp, session_id, expires_at)
     values ('+919000000002', null, null, now() + interval '5 minutes') $$,
  '23514',
  null,
  'otp_codes should reject a row with NEITHER otp nor session_id'
);

-- Layer 1: 90s per-phone cooldown
insert into public.otp_send_log (phone, ip_hash, created_at)
  values ('+919000000010', 'hash-a', now() - interval '10 seconds');
select is(
  (select allowed from public.fn_check_otp_send_allowed('+919000000010', 'hash-a')),
  false,
  'layer 1: a send 10s after the previous one should be blocked'
);

delete from public.otp_send_log where phone = '+919000000010';
insert into public.otp_send_log (phone, ip_hash, created_at)
  values ('+919000000010', 'hash-a', now() - interval '91 seconds');
select is(
  (select allowed from public.fn_check_otp_send_allowed('+919000000010', 'hash-a')),
  true,
  'layer 1: a send 91s after the previous one should be allowed'
);

-- Layer 2: 5 per phone per day
delete from public.otp_send_log;
insert into public.otp_send_log (phone, ip_hash, created_at)
select '+919000000020', 'hash-b', now() - (interval '2 hours' * g)
from generate_series(1, 5) g;
select is(
  (select allowed from public.fn_check_otp_send_allowed('+919000000020', 'hash-b')),
  false,
  'layer 2: the 6th send to one phone in 24h should be blocked'
);

-- Layer 3: 10 per IP per hour, across DIFFERENT phones (number rotation)
delete from public.otp_send_log;
insert into public.otp_send_log (phone, ip_hash, created_at)
select '+9190000001' || lpad(g::text, 2, '0'), 'hash-rotate', now() - interval '5 minutes'
from generate_series(1, 10) g;
select is(
  (select allowed from public.fn_check_otp_send_allowed('+919999999999', 'hash-rotate')),
  false,
  'layer 3: an 11th send from one IP across different phones should be blocked'
);

-- Layer 4: 1000 per day globally
delete from public.otp_send_log;
insert into public.otp_send_log (phone, ip_hash, created_at)
select '+9190000' || lpad(g::text, 5, '0'), 'hash-' || g, now()
from generate_series(1, 1000) g;
select is(
  (select allowed from public.fn_check_otp_send_allowed('+918888888888', 'hash-new')),
  false,
  'layer 4: send 1001 in a day should be blocked globally'
);

-- Null ip_hash skips layer 3 but still enforces layers 1/2/4
delete from public.otp_send_log;
select is(
  (select allowed from public.fn_check_otp_send_allowed('+919000000030', null)),
  true,
  'a null ip_hash should skip layer 3 rather than fail the request'
);

select * from finish();
rollback;
