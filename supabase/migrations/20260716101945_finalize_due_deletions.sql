create extension if not exists pg_net;
create extension if not exists pg_cron;

create function public.fn_finalize_due_deletions()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_request record;
  v_project_url text;
  v_service_role_key text;
begin
  select decrypted_secret into v_project_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_service_role_key from vault.decrypted_secrets where name = 'service_role_key';

  for v_request in
    select id, user_id
    from public.account_deletion_requests
    where status = 'pending'
      and scheduled_for <= now()
  loop
    perform public.anonymize_profile(v_request.user_id);

    perform net.http_post(
      url := v_project_url || '/functions/v1/finalize-account-ban',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
      ),
      body := jsonb_build_object('userId', v_request.user_id)
    );

    update public.account_deletion_requests
    set status = 'completed', completed_at = now()
    where id = v_request.id;
  end loop;
end;
$$;

revoke execute on function public.fn_finalize_due_deletions() from public;
revoke execute on function public.fn_finalize_due_deletions() from anon;
revoke execute on function public.fn_finalize_due_deletions() from authenticated;
grant execute on function public.fn_finalize_due_deletions() to service_role;

select cron.schedule(
  'finalize-due-account-deletions',
  '0 * * * *', -- every hour, on the hour
  $$select public.fn_finalize_due_deletions()$$
);
