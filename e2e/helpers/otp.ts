import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SECRET_KEY ??
  '';

export function hasServiceRole(): boolean {
  return !!SUPABASE_URL && !!SERVICE_ROLE_KEY;
}

/**
 * The pool of test numbers, from E2E_TEST_PHONES (comma-separated) or the
 * single E2E_TEST_PHONE.
 *
 * Every number used by a spec MUST also be in the backend's
 * TWOFACTOR_TEST_PHONES secret. That allowlist is what makes auth-send-otp
 * take its test-mode branch: it stores a fixed, readable code in otp_codes and
 * skips the provider entirely.
 *
 * A number that is NOT allowlisted takes the real 2Factor path, which stores
 * `otp: null` (only a provider session id) -- so fetchOtp finds nothing and
 * the spec fails with "No OTP found" -- and bills a real SMS to whoever owns
 * that number. Randomly generated numbers are therefore never acceptable here.
 */
function testPhonePool(): string[] {
  const raw = process.env.E2E_TEST_PHONES ?? process.env.E2E_TEST_PHONE ?? '';
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Claim a distinct allowlisted number for a spec file.
 *
 * Specs must not share a number: Playwright runs files in parallel, and two
 * specs on one number race over the same otp_codes row and auth user, so one
 * spec's cleanup deletes the other's login mid-flight.
 *
 * Throws rather than falling back to a random number. A random number would
 * turn a configuration mistake into real SMS charges and a confusing "No OTP
 * found" failure far from its cause.
 */
export function testPhoneFor(specName: string): string {
  const pool = testPhonePool();
  if (pool.length === 0) {
    throw new Error(
      'No E2E test phone configured. Set E2E_TEST_PHONES (comma-separated) or ' +
        'E2E_TEST_PHONE in .env.test.local, and make sure every number is also ' +
        'in the backend TWOFACTOR_TEST_PHONES secret. See e2e/README.md.',
    );
  }

  // Stable index per spec file, so a given spec always claims the same number
  // and reruns stay idempotent.
  const index = SPEC_PHONE_ORDER.indexOf(specName);
  if (index === -1) {
    throw new Error(
      `Unknown spec "${specName}" requesting a test phone. Add it to SPEC_PHONE_ORDER.`,
    );
  }
  if (index >= pool.length) {
    throw new Error(
      `Spec "${specName}" needs test phone #${index + 1}, but only ${pool.length} ` +
        `configured. Add more comma-separated numbers to E2E_TEST_PHONES (each ` +
        `also allowlisted in TWOFACTOR_TEST_PHONES).`,
    );
  }
  return pool[index];
}

/**
 * Fixed allocation order. Each spec that logs in gets its own number so
 * parallel files never contend for the same auth user.
 */
const SPEC_PHONE_ORDER = ['auth', 'checkout', 'route-guards'] as const;

/**
 * Convert a test number to the E.164 form the backend stores.
 *
 * Specs pass the bare 10 digits the login form collects, but the client
 * normalizes to "+91XXXXXXXXXX" before calling the edge function, so that is
 * what lands in `otp_codes.phone`. These helpers query the table directly and
 * bypass the client, so they must apply the same normalization -- an exact
 * string match on the bare digits silently finds nothing.
 */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+91${digits}`;
}

let admin: SupabaseClient | null = null;
function adminClient(): SupabaseClient {
  if (!hasServiceRole()) {
    throw new Error(
      'Auth E2E requires SUPABASE_SERVICE_ROLE_KEY (and VITE_SUPABASE_URL). ' +
        'Add it to .env.test.local — see e2e/README.md.',
    );
  }
  admin ??= createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return admin;
}

/**
 * Read the OTP for an allowlisted test number from `otp_codes` using the
 * service-role key (bypasses RLS). Real logins now go through 2Factor and the
 * code never touches this database -- only test-mode numbers, which skip the
 * provider, store a readable `otp` here.
 */
export async function fetchOtp(phone: string): Promise<string> {
  const { data, error } = await adminClient()
    .from('otp_codes')
    .select('otp, expires_at')
    .eq('phone', toE164(phone))
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to read otp_codes: ${error.message}`);
  if (!data) throw new Error(`No OTP found for ${phone}. Was send-otp called?`);
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error(`OTP for ${phone} is expired.`);
  }
  return data.otp;
}

/**
 * Find the auth user id for a phone. The auth user's phone may be stored with
 * or without a country-code prefix depending on how createUser normalized it,
 * so match on the trailing digits.
 *
 * Pages through listUsers rather than reading only the first page. listUsers
 * defaults to 50 users per page, so on a project with more users than that a
 * single call silently misses the test user -- cleanupPhone then no-ops, the
 * stale auth user survives into the next run, and verify-otp reports
 * isNewUser: false. The visible symptom is auth.spec.ts landing on / instead
 * of /register, which looks like a routing bug rather than failed cleanup.
 */
export async function findUserIdByPhone(phone: string): Promise<string | null> {
  const bare = phone.replace(/\D/g, '');
  const client = adminClient();

  const PER_PAGE = 200;
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    });
    if (error) throw new Error(`Failed to list auth users: ${error.message}`);

    const users = data?.users ?? [];
    const match = users.find((u) => {
      const p = (u.phone ?? '').replace(/\D/g, '');
      // An empty stored phone must never match: ''.endsWith(x) is false, but
      // bare.endsWith('') is true, which would return an arbitrary user.
      if (!p) return false;
      return p.endsWith(bare) || bare.endsWith(p);
    });
    if (match) return match.id;

    // A short page is the last page.
    if (users.length < PER_PAGE) return null;
  }
}

/**
 * Seed a default delivery address for the logged-in test user. Checkout stalls
 * on the AddressModal without one, so tests insert it via service-role.
 * Retries the user lookup briefly since the profile/user row is created during
 * OTP verify and may lag a moment behind the UI landing on home.
 */
export async function seedAddress(phone: string): Promise<void> {
  const client = adminClient();

  let userId: string | null = null;
  for (let i = 0; i < 10 && !userId; i++) {
    userId = await findUserIdByPhone(phone);
    if (!userId) await new Promise((r) => setTimeout(r, 500));
  }
  if (!userId) throw new Error(`No auth user for ${phone} to attach address.`);

  const { error } = await client.from('addresses').insert({
    user_id: userId,
    label: 'Home',
    flat_house: '42',
    building: 'Test Residency',
    street: 'MG Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    is_default: true,
  });
  if (error) throw new Error(`Failed to seed address: ${error.message}`);
}

/**
 * Delete just the `profiles` row for a phone's user, leaving the auth user (and
 * therefore any live Supabase session) intact. Reproduces the "session without
 * profile" state — e.g. a profile deleted out from under a signed-in session,
 * or an abandoned /register — used to test that guarded routes don't strand
 * such a user on an authenticated page.
 */
export async function deleteProfileKeepAuthUser(phone: string): Promise<void> {
  const userId = await findUserIdByPhone(phone);
  if (!userId) throw new Error(`No auth user for ${phone} to delete profile.`);
  const { error } = await adminClient()
    .from('profiles')
    .delete()
    .eq('id', userId);
  if (error) throw new Error(`Failed to delete profile: ${error.message}`);
}

/**
 * Remove the test user and any leftover OTP rows so runs stay idempotent.
 *
 * `orders.user_id` references `profiles` WITHOUT `on delete cascade` -- unlike
 * `addresses` and `account_deletion_requests`, which both cascade. That is
 * deliberate in production: accounts are retired by finalize-account-ban,
 * which bans and anonymises the auth user and deliberately keeps order history
 * intact. Nothing in the app ever hard-deletes a user.
 *
 * Tests do need a hard delete, so they must clear the blocking orders
 * themselves. Without this, deleting a user who has placed an order fails the
 * cascade to `profiles` with a foreign-key violation, which GoTrue surfaces as
 * an opaque HTTP 500. Swallowing that error left the user in place, so
 * verify-otp reported isNewUser: false and the next run landed on / instead of
 * /register -- a failure that looks like a routing bug several steps away from
 * its actual cause.
 */
export async function cleanupPhone(phone: string): Promise<void> {
  const client = adminClient();
  await client.from('otp_codes').delete().eq('phone', toE164(phone));

  const userId = await findUserIdByPhone(phone);
  if (!userId) return;

  // order_items cascade from orders; addresses and account_deletion_requests
  // cascade from profiles. Only orders must be cleared by hand.
  const { error: ordersError } = await client
    .from('orders')
    .delete()
    .eq('user_id', userId);
  if (ordersError) {
    throw new Error(`Failed to delete test orders: ${ordersError.message}`);
  }

  const { error: deleteError } = await client.auth.admin.deleteUser(userId);
  if (deleteError) {
    throw new Error(
      `Failed to delete test auth user: ${deleteError.message}. Cleanup must ` +
        'fail loudly -- a surviving user makes the next run see a returning ' +
        'number and skip the /register step.',
    );
  }
}
