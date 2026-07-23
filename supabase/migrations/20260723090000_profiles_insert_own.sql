-- Allow a signed-in user to insert their own profile row.
--
-- profiles rows are normally created by the on_auth_user_created trigger, so
-- clients only ever needed SELECT + UPDATE. But a session can outlive its
-- profile (the row was deleted, or onboarding was abandoned before the trigger
-- state settled), leaving a valid session with no profile. Completing
-- registration then upserts the profile, which needs INSERT. Without this
-- policy the insert is blocked by RLS and registration fails.
--
-- Scoped to the caller's own id, matching profiles_select_own / _update_own.
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());
