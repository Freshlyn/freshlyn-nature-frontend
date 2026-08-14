import { test, expect, devices } from '@playwright/test';
import {
  fetchOtp,
  cleanupPhone,
  deleteProfileKeepAuthUser,
  seedLocationPreference,
  hasServiceRole,
  testPhoneFor,
} from './helpers/otp';

// A signed-in session whose `profiles` row is gone (verified OTP but abandoned
// /register, or a profile deleted under a live session) must NOT be left
// stranded on the authenticated Home page. ProtectedRoute should treat
// "session but no profile" as onboarding-incomplete and redirect to /register.
//
// Requires SUPABASE_SERVICE_ROLE_KEY (deletes the profile row via service-role
// and reads the OTP back); skipped otherwise so the secret-less suite still runs.
test.describe('route guards: session without a profile', () => {
  test.skip(
    !hasServiceRole(),
    'SUPABASE_SERVICE_ROLE_KEY not set — skipping real-auth E2E.',
  );

  // MUST be allowlisted in TWOFACTOR_TEST_PHONES. A random number takes the
  // real 2Factor path, which stores no readable OTP (so fetchOtp fails) and
  // bills an SMS to a stranger.
  const phone = testPhoneFor('route-guards');

  test.beforeEach(async () => {
    await cleanupPhone(phone);
  });
  test.afterEach(async () => {
    await cleanupPhone(phone);
  });

  // Run in a mobile viewport: this is exactly the case reported in the browser
  // (374px wide, no bottom nav), so guard the mobile layout explicitly.
  test.use({ viewport: devices['Pixel 5'].viewport });

  test('is redirected to /register, not stranded on Home', async ({ page }) => {
    // 1. Log in for real so the browser holds a valid Supabase session.
    await page.goto('/login');
    await page.getByTestId('input-phone').fill(phone);
    await page.getByTestId('button-send-otp').click();
    await expect(page.getByTestId('input-otp')).toBeVisible();
    const otp = await fetchOtp(phone);
    await page.getByTestId('input-otp').fill(otp);
    await page.getByTestId('button-verify-otp').click();

    // New number -> lands on /register (profile exists but is incomplete).
    await expect(page).toHaveURL(/\/register$/);

    // 2. Delete the profile row out from under the live session.
    await deleteProfileKeepAuthUser(phone);

    // 3. Navigate to the protected Home route with the profile gone.
    await page.goto('/');

    // The bug: Home renders (session-gated) while the header shows "Login" and
    // no bottom nav (profile-gated) — a split-brain authenticated page.
    // Correct behavior: bounce to /register to finish onboarding.
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByTestId('product-grid')).toHaveCount(0);
    await expect(page.getByTestId('button-login')).toHaveCount(0);
  });

  test('profile-less session can complete registration (recreates the profile row)', async ({
    page,
  }) => {
    // Reach the "session but no profile row" state: log in, then delete the row.
    // Answer the app-open location screen first so its overlay never blocks Home.
    await seedLocationPreference(page);
    await page.goto('/login');
    await page.getByTestId('input-phone').fill(phone);
    await page.getByTestId('button-send-otp').click();
    await expect(page.getByTestId('input-otp')).toBeVisible();
    const otp = await fetchOtp(phone);
    await page.getByTestId('input-otp').fill(otp);
    await page.getByTestId('button-verify-otp').click();
    await expect(page).toHaveURL(/\/register$/);
    await deleteProfileKeepAuthUser(phone);
    await page.goto('/');
    await expect(page).toHaveURL(/\/register$/);

    // Completing registration must succeed even though no profiles row exists —
    // updateProfile has to create it, not UPDATE-zero-rows (which 406s). The
    // user should land on the authenticated Home, not stay stuck on /register.
    await page.getByTestId('input-name').fill('Recreated User');
    await page.getByTestId('button-register').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('product-grid')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
  });

  test('completing registration lands on Home without bouncing back to /register', async ({
    page,
  }) => {
    // This test asserts on Home; the location screen's overlay would intercept.
    await seedLocationPreference(page);
    await page.goto('/login');
    await page.getByTestId('input-phone').fill(phone);
    await page.getByTestId('button-send-otp').click();
    await expect(page.getByTestId('input-otp')).toBeVisible();
    const otp = await fetchOtp(phone);
    await page.getByTestId('input-otp').fill(otp);
    await page.getByTestId('button-verify-otp').click();
    await expect(page).toHaveURL(/\/register$/);

    // Record every main-frame navigation from the moment we submit the form.
    // After saving the profile the app must go straight to Home and stay there.
    // A transient hop back through /register (caused by needsProfileCompletion
    // flip-flopping while the profile query refetches) is the bug: on a slow
    // refetch that intermediate /register can stick and strand the new user.
    const trail: string[] = [];
    page.on('framenavigated', (f) => {
      if (f === page.mainFrame()) trail.push(new URL(f.url()).pathname);
    });

    await page.getByTestId('input-name').fill('E2E New User');
    await page.getByTestId('button-register').click();

    // Lands on Home with the authenticated chrome present.
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('product-grid')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toBeVisible();

    // And never round-tripped through /register on the way.
    expect(
      trail.includes('/register'),
      `navigation bounced through /register: [${trail.join(' -> ')}]`,
    ).toBe(false);
  });
});
