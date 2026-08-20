# E2E tests (Playwright)

Playwright smoke + auth tests that drive the app in a real browser against the
Vite dev server.

See [TEST-PLAN.md](./TEST-PLAN.md) for the full feature-coverage checklist —
every user-facing feature mapped to a test scenario, with what's covered today
and where the remaining specs should go.

## Run

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # Playwright UI mode
npm run test:e2e:headed   # watch the browser
```

`playwright.config.ts` starts the dev server automatically (reusing one if
already running) and points tests at http://localhost:5173.

## Specs

- **smoke.spec.ts** — no secrets required. App boots, `/login` renders, protected
  routes redirect to `/login` when signed out, unknown routes 404, phone
  validation.
- **auth.spec.ts** — full phone → OTP login against real Supabase. The OTP is
  random and never shown in the UI, so the test reads it from the `otp_codes`
  table with the **service-role key**. Skipped automatically if the key is
  absent.
- **checkout.spec.ts** — full authenticated purchases, both delivery modes:
  a **one-time** order (open first product → add → cart → checkout → `/orders`)
  and a **subscription** order (open Milk → pick plan/frequency → subscribe →
  cart → checkout → `/orders`). Seeds a default delivery address via
  service-role (checkout otherwise stalls on the address modal). Also requires
  the service-role key; skipped without it.

## Enabling the auth spec

The OTP read needs a service-role key. Copy the template and fill it in:

```bash
cp .env.test.example .env.test.local
# then set SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

`.env.test.local` is gitignored. Each auth test claims its own number from
`E2E_TEST_PHONES` and cleans up the test user + OTP rows before and after
itself.

## Test phone numbers (both halves are required)

Any spec that logs in needs a number that is configured in **two** places. Miss
either one and the spec fails with `No OTP found for …`.

**1. Locally**, in `.env.test.local` — a comma-separated pool:

```
E2E_TEST_PHONES=9123456789,9123456780,9123456790
```

Numbers are allocated **by position** against `SPEC_PHONE_ORDER` in
[helpers/otp.ts](./helpers/otp.ts), so a spec always gets the same number and
reruns stay idempotent. Only ever *append* to that list — reordering silently
reassigns numbers between specs. A spec past the end of the pool skips itself
rather than running; add another number to switch it on.

**2. On the backend**, in the `TWOFACTOR_TEST_PHONES` edge-function secret —
in **E.164 form**:

```bash
supabase secrets set \
  TWOFACTOR_TEST_PHONES='+919123456789,+919123456780,+919123456790' \
  --project-ref <your-project-ref>
```

The match is an exact string comparison against the E.164 phone the client
sends ([auth-send-otp/handler.ts](../supabase/functions/auth-send-otp/handler.ts)),
with no normalization — so `9123456789`, `919123456789`, or a stray space
inside a number will **not** match.

### Why this matters

An allowlisted number takes the test-mode branch: no provider call, no SMS, no
cost, and a fixed readable code (`123456`) written to `otp_codes` for
`fetchOtp` to read back. A number that is *not* allowlisted takes the real
2Factor path, which stores only a provider session id (`otp` is `NULL`) — so
`fetchOtp` finds nothing *and* a real SMS is billed to whoever owns that
number. That is why `testPhoneFor` throws instead of inventing a fallback.

### Diagnosing "No OTP found"

The send returning `{"success":true}` while `otp_codes` has no readable row
means the number reached the **real provider** — i.e. it is missing from
`TWOFACTOR_TEST_PHONES`, or is listed there in the wrong format.
