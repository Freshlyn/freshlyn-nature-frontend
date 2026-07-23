import { test, expect } from '@playwright/test';

// Smoke coverage that needs no auth: the app boots, the login screen renders,
// protected routes bounce unauthenticated visitors to /login, and unknown
// routes render the 404. These guard the routing/render wiring in App.tsx.

test.describe('smoke: app boots and routes', () => {
  test('login page renders the phone form', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Login or Sign Up' }),
    ).toBeVisible();
    await expect(page.getByTestId('input-phone')).toBeVisible();
    await expect(page.getByTestId('button-send-otp')).toBeVisible();
  });

  test('protected home route redirects to /login when signed out', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByTestId('input-phone')).toBeVisible();
  });

  test('protected /orders redirects to /login when signed out', async ({
    page,
  }) => {
    await page.goto('/orders');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('unknown route renders the 404 page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByText(/404/)).toBeVisible();
  });

  test('send-otp validation blocks short phone numbers', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('input-phone').fill('12345');
    // Button stays disabled below 10 digits — no OTP screen appears.
    await expect(page.getByTestId('button-send-otp')).toBeDisabled();
  });
});
