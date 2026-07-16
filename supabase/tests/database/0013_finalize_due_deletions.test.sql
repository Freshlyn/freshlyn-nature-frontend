begin;
select plan(6);

select has_function(
  'public', 'fn_finalize_due_deletions', array[]::text[],
  'fn_finalize_due_deletions function should exist'
);

insert into auth.users (id, phone, email) values
  ('c1000000-0000-0000-0000-000000000001', '+910000000301', 'due-a@example.com'),
  ('c1000000-0000-0000-0000-000000000002', '+910000000302', 'flagged-b@example.com'),
  ('c1000000-0000-0000-0000-000000000003', '+910000000303', 'notdue-c@example.com');

insert into public.account_deletion_requests (id, user_id, requested_at, scheduled_for, status) values
  ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', now() - interval '8 days', now() - interval '1 hour', 'pending'),
  ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000002', now() - interval '30 days', now() - interval '23 days', 'flagged'),
  ('c2000000-0000-0000-0000-000000000003', 'c1000000-0000-0000-0000-000000000003', now(), now() + interval '6 days', 'pending');

select public.fn_finalize_due_deletions();

select is(
  (select status from public.account_deletion_requests where id = 'c2000000-0000-0000-0000-000000000001'),
  'completed',
  'a pending request past its scheduled_for should be finalized to completed'
);

select is(
  (select name from public.profiles where id = 'c1000000-0000-0000-0000-000000000001'),
  'Deleted User',
  'finalizing a due request should anonymize the profile via anonymize_profile'
);

select is(
  (select status from public.account_deletion_requests where id = 'c2000000-0000-0000-0000-000000000002'),
  'flagged',
  'a flagged request should never be auto-finalized, no matter how overdue'
);

select is(
  (select status from public.account_deletion_requests where id = 'c2000000-0000-0000-0000-000000000003'),
  'pending',
  'a pending request not yet at its scheduled_for should be left untouched'
);

set local role authenticated;
select throws_ok(
  $$ select public.fn_finalize_due_deletions() $$,
  '42501',
  null,
  'fn_finalize_due_deletions should reject calls from the authenticated role (service_role only)'
);
reset role;

select * from finish();
rollback;
