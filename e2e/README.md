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

`.env.test.local` is gitignored. Each auth test uses a random throwaway phone
number and cleans up the test user + OTP rows before and after itself.
