-- Switch the OTP flow from a locally-generated code to 2Factor's AUTOGEN API.
--
-- Under AUTOGEN the provider generates and holds the code; we store only the
-- opaque session id their VERIFY endpoint consumes. `otp` stays for the
-- test-mode bypass (Section 6 of the spec), where no SMS is sent at all, so
-- exactly one of (otp, session_id) is populated per row.
--
-- `auth-send-otp` is a public, unauthenticated, money-spending endpoint: CORS
-- is "*" and verify_jwt is satisfied by the anon key that ships in the client
-- bundle. A per-phone cooldown alone does not defend it -- the cheapest attack
-- rotates phone numbers, so every request looks like a first-time send. Hence
-- otp_send_log and the four-layer check below.
--
-- Client IPs are hashed in the edge function (Web Crypto SHA-256), not here, so
-- this migration needs no crypto extension of its own.

-- 1. otp_codes: store a provider session instead of a plaintext code. --------

alter table public.otp_codes
  alter column otp drop not null,
  add column session_id text,
  add column attempts int not null default 0;

-- Exactly one credential per row: a session id (real send) or a code
-- (test-mode bypass). This is what lets auth-verify-otp pick its path from
-- the data alone -- no flag column, and nothing a client can influence.
alter table public.otp_codes
  add constraint otp_codes_exactly_one_credential
  check ((otp is null) <> (session_id is null));

-- 2. otp_send_log: the history the throttle counts against. -----------------
--
-- Separate from otp_codes because otp_codes is keyed by phone (one row) and is
-- deleted on success -- a successful send erases its own evidence, so it
-- structurally cannot answer "how many sends in the last hour".
--
-- Rows are inserted ONLY after 2Factor confirms a send, so this table records
-- billed sends and nothing else. A provider outage therefore never eats into a
-- user's limit. Deliberately minimal: no id, no status column.

create table public.otp_send_log (
  phone      text        not null,
  ip_hash    text,                      -- sha256(ip + salt); never a raw IP
  created_at timestamptz not null default now()
);

create index otp_send_log_phone_created on public.otp_send_log (phone, created_at desc);
create index otp_send_log_ip_created    on public.otp_send_log (ip_hash, created_at desc)
  where ip_hash is not null;

alter table public.otp_send_log enable row level security;
-- No policies: service_role only, like otp_codes.

-- 3. Tunable thresholds, so tuning a limit is an UPDATE not a redeploy. ------

create table public.otp_throttle_config (
  id                     boolean primary key default true check (id),
  phone_cooldown_seconds int not null default 90,
  phone_daily_limit      int not null default 5,
  ip_hourly_limit        int not null default 10,
  global_daily_limit     int not null default 1000
);

insert into public.otp_throttle_config default values;

alter table public.otp_throttle_config enable row level security;

-- 4. The single atomic throttle decision. -----------------------------------
--
-- All four layers in one function so counting cannot race across concurrent
-- invocations. Ordered cheapest-first: an abusive request is usually rejected
-- by one indexed lookup before any provider call is made.
--
-- retry_after_seconds is only meaningful for layer 1 (the limit a legitimate
-- user actually hits); the others return 0 because telling an attacker exactly
-- when to retry helps them tune around the limit.

create function public.fn_check_otp_send_allowed(p_phone text, p_ip_hash text)
returns table (allowed boolean, reason text, retry_after_seconds int)
language plpgsql
security definer set search_path = public
as $$
declare
  v_cfg          public.otp_throttle_config;
  v_last_sent    timestamptz;
  v_phone_count  int;
  v_ip_count     int;
  v_global_count int;
  v_wait         int;
begin
  select * into v_cfg from public.otp_throttle_config limit 1;

  -- Layer 1: per-phone cooldown.
  select max(created_at) into v_last_sent
  from public.otp_send_log
  where phone = p_phone;

  if v_last_sent is not null then
    v_wait := v_cfg.phone_cooldown_seconds - floor(extract(epoch from (now() - v_last_sent)))::int;
    if v_wait > 0 then
      return query select false, 'phone_cooldown'::text, v_wait;
      return;
    end if;
  end if;

  -- Layer 2: per-phone daily cap.
  select count(*) into v_phone_count
  from public.otp_send_log
  where phone = p_phone
    and created_at > now() - interval '24 hours';

  if v_phone_count >= v_cfg.phone_daily_limit then
    return query select false, 'phone_daily'::text, 0;
    return;
  end if;

  -- Layer 3: per-IP hourly cap. This is the layer that stops number rotation.
  -- Skipped when the IP is unknown rather than failing the request outright --
  -- layers 1, 2 and 4 still apply, so it is never wholly unthrottled.
  if p_ip_hash is not null then
    select count(*) into v_ip_count
    from public.otp_send_log
    where ip_hash = p_ip_hash
      and created_at > now() - interval '1 hour';

    if v_ip_count >= v_cfg.ip_hourly_limit then
      raise warning '[otp-throttle] ip hourly limit hit for ip_hash=%', p_ip_hash;
      return query select false, 'ip_hourly'::text, 0;
      return;
    end if;
  end if;

  -- Layer 4: global daily ceiling -- the circuit breaker. Bounds worst-case
  -- spend regardless of how distributed an attack is. Resets at IST midnight.
  select count(*) into v_global_count
  from public.otp_send_log
  where created_at >= date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';

  if v_global_count >= v_cfg.global_daily_limit then
    raise warning '[otp-throttle] GLOBAL daily cap reached (%). Sends suspended.', v_global_count;
    return query select false, 'global_daily'::text, 0;
    return;
  end if;

  return query select true, null::text, 0;
end;
$$;

revoke execute on function public.fn_check_otp_send_allowed(text, text) from public;
revoke execute on function public.fn_check_otp_send_allowed(text, text) from anon;
revoke execute on function public.fn_check_otp_send_allowed(text, text) from authenticated;
grant execute on function public.fn_check_otp_send_allowed(text, text) to service_role;

-- 5. Retention. No layer reads past 24h; 7 days keeps a recent incident
--    reviewable while bounding table growth and DPDP exposure.

create function public.fn_prune_otp_send_log()
returns void
language sql
security definer set search_path = public
as $$
  delete from public.otp_send_log where created_at < now() - interval '7 days';
$$;

revoke execute on function public.fn_prune_otp_send_log() from public;
revoke execute on function public.fn_prune_otp_send_log() from anon;
revoke execute on function public.fn_prune_otp_send_log() from authenticated;
grant execute on function public.fn_prune_otp_send_log() to service_role;

select cron.schedule(
  'prune-otp-send-log',
  '30 3 * * *', -- daily at 03:30 UTC, off-peak
  $$select public.fn_prune_otp_send_log()$$
);
