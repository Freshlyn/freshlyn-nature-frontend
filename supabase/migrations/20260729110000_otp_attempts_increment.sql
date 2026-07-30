-- Atomic increment for the verify-attempt cap.
--
-- Kept in its own migration rather than appended to 20260729100000: that file
-- is pushed as soon as auth-send-otp goes live, and Supabase never re-runs an
-- already-applied migration -- an appended function would silently never exist
-- on the remote project.
--
-- Atomic so two concurrent wrong guesses cannot both read the same attempts
-- value and collapse two failures into one.

create function public.fn_increment_otp_attempts(p_phone text)
returns void
language sql
security definer set search_path = public
as $$
  update public.otp_codes set attempts = attempts + 1 where phone = p_phone;
$$;

revoke execute on function public.fn_increment_otp_attempts(text) from public;
revoke execute on function public.fn_increment_otp_attempts(text) from anon;
revoke execute on function public.fn_increment_otp_attempts(text) from authenticated;
grant execute on function public.fn_increment_otp_attempts(text) to service_role;
