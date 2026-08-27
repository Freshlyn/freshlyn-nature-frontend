import { test, expect } from '@playwright/test';
import { seedLocationPreference } from './helpers/otp';

// Smoke coverage that needs no auth: the app boots, the login screen renders,
// Home is browsable signed out, protected routes bounce unauthenticated
// visitors to /login, and unknown routes render the 404. These guard the
// routing/render wiring in App.tsx.

test.describe('smoke: app boots and routes', () => {
  test('login page renders the phone form', async ({ page }) => {
    await page.goto('/login');
    await expect(
      page.getByRole('heading', { name: 'Login or Sign Up' }),
    ).toBeVisible();
    await expect(page.getByTestId('input-phone')).toBeVisible();
    await expect(page.getByTestId('button-send-otp')).toBeVisible();
  });

  // The storefront is public: browsing must work with no session at all.
  // This asserts the inverse of the old guard -- Home used to bounce to /login.
  //
  // The grid assertion needs the anon-read policies from migration
  // 20260826140000 on whichever backend this runs against. Without them the
  // page still renders publicly (everything below the grid passes) but the
  // catalogue query returns zero rows and Home shows "No products found" --
  // so a failure HERE with the rest of the test green means the migration has
  // not been applied to that environment, not that routing regressed.
  test('home renders the catalogue when signed out', async ({ page }) => {
    // Answer the app-open location screen first, or its overlay covers the grid.
    await seedLocationPreference(page);
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    // The page is public: a guest is not bounced to /login.
    await expect(page.getByTestId('button-login')).toBeVisible();
    await expect(page.getByTestId('bottom-nav')).toHaveCount(0);
    // And the catalogue is readable without a session.
    await expect(page.getByTestId('product-grid')).toBeVisible();
  });

  test('/cart still redirects to /login when signed out', async ({ page }) => {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/login$/);
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
