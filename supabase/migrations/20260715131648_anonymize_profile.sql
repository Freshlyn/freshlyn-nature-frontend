create function public.anonymize_profile(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.subscription_deliveries
  set status = 'cancelled'
  where status = 'scheduled'
    and order_item_id in (
      select oi.id
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.user_id = p_user_id
    );

  delete from public.addresses where user_id = p_user_id;

  update public.profiles
  set name = 'Deleted User', phone = null, email = null
  where id = p_user_id;
end;
$$;

revoke execute on function public.anonymize_profile(uuid) from public;
revoke execute on function public.anonymize_profile(uuid) from anon;
revoke execute on function public.anonymize_profile(uuid) from authenticated;
grant execute on function public.anonymize_profile(uuid) to service_role;
