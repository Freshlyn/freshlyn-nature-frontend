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
 * Read the most recent, unexpired OTP for a phone number straight from the
 * `otp_codes` table using the service-role key (bypasses RLS). The app never
 * exposes the code to the UI ("Demo Mode"), so tests fetch it here.
 */
export async function fetchOtp(phone: string): Promise<string> {
  const { data, error } = await adminClient()
    .from('otp_codes')
    .select('otp, expires_at')
    .eq('phone', phone)
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
 */
export async function findUserIdByPhone(phone: string): Promise<string | null> {
  const bare = phone.replace(/\D/g, '');
  const { data: list } = await adminClient().auth.admin.listUsers();
  const match = list?.users.find((u) => {
    const p = (u.phone ?? '').replace(/\D/g, '');
    return p.endsWith(bare) || bare.endsWith(p);
  });
  return match?.id ?? null;
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

/** Remove the test user and any leftover OTP rows so runs stay idempotent. */
export async function cleanupPhone(phone: string): Promise<void> {
  const client = adminClient();
  await client.from('otp_codes').delete().eq('phone', phone);

  // Deleting the auth user cascades to profiles -> addresses/orders.
  const userId = await findUserIdByPhone(phone);
  if (userId) await client.auth.admin.deleteUser(userId);
}
