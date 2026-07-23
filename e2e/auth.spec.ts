import { test, expect } from '@playwright/test';
import { fetchOtp, cleanupPhone, hasServiceRole } from './helpers/otp';

// Full phone -> OTP login against real Supabase. The OTP is random and never
// shown in the UI, so we read it back from the otp_codes table with the
// service-role key. Requires SUPABASE_SERVICE_ROLE_KEY (see e2e/README.md);
// skipped otherwise so the suite still runs without secrets.
test.describe('auth: phone + OTP login', () => {
  test.skip(
    !hasServiceRole(),
    'SUPABASE_SERVICE_ROLE_KEY not set — skipping real-auth E2E.',
  );

  // Random 10-digit test number so parallel/repeat runs do not collide.
  const phone = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

  test.beforeEach(async () => {
    await cleanupPhone(phone);
  });
  test.afterEach(async () => {
    await cleanupPhone(phone);
  });

  test('new user logs in via OTP and lands on the register step', async ({
    page,
  }) => {
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
});
