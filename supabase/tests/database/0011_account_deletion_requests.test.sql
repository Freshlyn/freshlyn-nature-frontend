begin;
select plan(7);

select has_table('public', 'account_deletion_requests', 'account_deletion_requests table should exist');

insert into auth.users (id, phone, email) values
  ('a1000000-0000-0000-0000-000000000001', '+910000000101', 'del-a@example.com'),
  ('a1000000-0000-0000-0000-000000000002', '+910000000102', 'del-b@example.com');

insert into public.account_deletion_requests (id, user_id, scheduled_for, status) values
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', now() + interval '7 days', 'pending');

select throws_ok(
  $$ insert into public.account_deletion_requests (user_id, scheduled_for, status)
     values ('a1000000-0000-0000-0000-000000000001', now() + interval '7 days', 'flagged') $$,
  '23505',
  null,
  'a second active (pending/flagged) request for the same user should violate the partial unique index'
);

insert into public.account_deletion_requests (id, user_id, scheduled_for, status) values
  ('a2000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', now() + interval '7 days', 'pending');

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);

select is(
  (select count(*)::int from public.account_deletion_requests where id = 'a2000000-0000-0000-0000-000000000002'),
  0,
  'user A should not be able to select user B''s deletion request under RLS'
);

select is(
  (select count(*)::int from public.account_deletion_requests where id = 'a2000000-0000-0000-0000-000000000001'),
  1,
  'user A should be able to select their own deletion request under RLS'
);

select public.cancel_account_deletion();

select is(
  (select status from public.account_deletion_requests where id = 'a2000000-0000-0000-0000-000000000001'),
  'cancelled',
  'cancel_account_deletion should mark the caller''s own pending request as cancelled'
);

reset role;

update public.account_deletion_requests set status = 'completed', completed_at = now()
  where id = 'a2000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-0000-0000-000000000001', true);
select public.cancel_account_deletion();

select is(
  (select status from public.account_deletion_requests where id = 'a2000000-0000-0000-0000-000000000001'),
  'completed',
  'cancel_account_deletion should be a no-op against a completed request'
);

select public.cancel_account_deletion();
reset role;

select is(
  (select status from public.account_deletion_requests where id = 'a2000000-0000-0000-0000-000000000002'),
  'pending',
  'cancel_account_deletion called by user A should never touch user B''s own pending request'
);

select * from finish();
rollback;
