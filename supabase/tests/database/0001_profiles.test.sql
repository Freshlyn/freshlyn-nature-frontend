begin;
select plan(4);

select has_table('public', 'profiles', 'profiles table should exist');
select has_column('public', 'profiles', 'id', 'profiles.id should exist');
select col_is_pk('public', 'profiles', 'id', 'profiles.id should be the primary key');

insert into auth.users (id, phone, email)
values ('11111111-1111-1111-1111-111111111111', '+911234567890', 'test@example.com');

select results_eq(
  $$ select name, phone, email from public.profiles where id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('+911234567890'::text, '+911234567890'::text, 'test@example.com'::text) $$,
  'handle_new_user trigger should populate a profiles row from the auth.users insert'
);

select * from finish();
rollback;
