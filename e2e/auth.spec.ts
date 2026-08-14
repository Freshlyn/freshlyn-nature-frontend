import { test, expect } from '@playwright/test';
import {
  fetchOtp,
  cleanupPhone,
  seedLocationPreference,
  hasServiceRole,
  testPhoneFor,
} from './helpers/otp';

// Full phone -> OTP login against real Supabase. The OTP is random and never
// shown in the UI, so we read it back from the otp_codes table with the
// service-role key. Requires SUPABASE_SERVICE_ROLE_KEY (see e2e/README.md);
// skipped otherwise so the suite still runs without secrets.
test.describe('auth: phone + OTP login', () => {
  test.skip(
    !hasServiceRole(),
    'SUPABASE_SERVICE_ROLE_KEY not set — skipping real-auth E2E.',
  );

  // MUST be listed in the TWOFACTOR_TEST_PHONES secret. An allowlisted number
  // bypasses 2Factor entirely, so this suite sends no SMS and costs nothing.
  // A random number here would text a real stranger on every run.
  const phone = testPhoneFor('auth');

  test.beforeEach(async () => {
    await cleanupPhone(phone);
  });
  test.afterEach(async () => {
    await cleanupPhone(phone);
  });

  test('new user logs in via OTP and lands on the register step', async ({
    page,
  }) => {
    // This test ends up on Home. Today its assertions only read visibility and
    // computed styles, which the location screen's overlay does not block, but
    // seeding keeps it consistent with the other Home-reaching specs.
    await seedLocationPreference(page);
    await page.goto('/login');

    await page.getByTestId('input-phone').fill(phone);
    await page.getByTestId('button-send-otp').click();

    // OTP screen appears.
    await expect(page.getByTestId('input-otp')).toBeVisible();

    // Read the code the edge function just wrote, then verify.
    const otp = await fetchOtp(phone);
    await page.getByTestId('input-otp').fill(otp);
    await page.getByTestId('button-verify-otp').click();

    // Brand-new number -> Register page for profile completion.
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByTestId('input-name')).toBeVisible();

    // Completing the profile lands on the authenticated home.
    await page.getByTestId('input-name').fill('E2E Test User');
    await page.getByTestId('button-register').click();
    await expect(page).toHaveURL(/\/$/);

    // Safe-area utilities (pt-safe-t / pb-safe-b) must resolve to 0px in a
    // browser, so adding them for Android did not shift the web layout.
    // Asserted here rather than in a spec of its own because Header and
    // BottomNav only exist for a signed-in user, and this test already has
    // one -- a separate file would need a fourth allowlisted number and would
    // race with this one under fullyParallel.
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    expect(await header.evaluate((el) => getComputedStyle(el).paddingTop)).toBe('0px');

    await page.setViewportSize({ width: 390, height: 844 });
    const nav = page.getByTestId('bottom-nav');
    await expect(nav).toBeVisible();
    expect(await nav.evaluate((el) => getComputedStyle(el).paddingBottom)).toBe('0px');
  });

  test('wrong OTP shows a verification error and stays on /login', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByTestId('input-phone').fill(phone);
    await page.getByTestId('button-send-otp').click();
    await expect(page.getByTestId('input-otp')).toBeVisible();

    await page.getByTestId('input-otp').fill('000000');

    // A destructive toast reports the failure. Toasts auto-dismiss after 3s
    // (Toaster duration), so start waiting for it *before* the click to avoid
    // racing the dismissal, then trigger verify.
    const errorToast = page
      .getByRole('region', { name: /notifications/i })
      .getByText(/Invalid or expired OTP/i);
    await page.getByTestId('button-verify-otp').click();
    await expect(errorToast).toBeVisible({ timeout: 3000 });

    // The core assertion: login did NOT succeed — we stay on the OTP screen
    // and were not navigated to home or the register step.
    await expect(page.getByTestId('input-otp')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('resend is disabled for 90 seconds after sending a code', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('input-phone').fill(phone);
    await page.getByTestId('button-send-otp').click();
    await expect(page.getByTestId('input-otp')).toBeVisible();

    const resend = page.getByTestId('button-resend-otp');
    await expect(resend).toBeDisabled();
    await expect(resend).toContainText(/Resend in \d+s/);
  });
});
