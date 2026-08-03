import { test, expect, type Page } from '@playwright/test';
import {
  fetchOtp,
  seedAddress,
  cleanupPhone,
  hasServiceRole,
} from './helpers/otp';

// Full authenticated purchase flows in a real browser against real Supabase:
// login -> add a product (one-time or subscription) -> cart -> checkout ->
// orders. Requires the service-role key (reads the OTP, seeds a delivery
// address); skipped without it.
test.describe('checkout: place an order', () => {
  test.skip(
    !hasServiceRole(),
    'SUPABASE_SERVICE_ROLE_KEY not set — skipping real-checkout E2E.',
  );

  const phone = `9${Math.floor(100000000 + Math.random() * 899999999)}`;

  test.beforeEach(async () => {
    await cleanupPhone(phone);
  });
  test.afterEach(async () => {
    await cleanupPhone(phone);
  });

  // Log in a fresh user via phone + OTP, complete the register step, and seed a
  // default delivery address (checkout otherwise stalls on the address modal).
  async function loginAndPrepare(page: Page) {
    await page.goto('/login');
    await page.getByTestId('input-phone').fill(phone);
    await page.getByTestId('button-send-otp').click();
    await expect(page.getByTestId('input-otp')).toBeVisible();
    await page.getByTestId('input-otp').fill(await fetchOtp(phone));
    await page.getByTestId('button-verify-otp').click();

    await expect(page).toHaveURL(/\/register$/);
    await page.getByTestId('input-name').fill('E2E Checkout User');
    await page.getByTestId('button-register').click();
    await expect(page).toHaveURL(/\/$/);

    await seedAddress(phone);
  }

  // From the cart: verify a positive total against the seeded address, place
  // the order, and confirm the redirect to /orders (the durable success signal
  // — the "Order Placed!" toast auto-dismisses).
  async function reviewCartAndCheckout(page: Page) {
    await page.goto('/cart');
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.getByTestId('text-selected-address')).toBeVisible();
    const grandTotal = page.getByTestId('text-grand-total');
    await expect(grandTotal).toBeVisible();
    await expect(grandTotal).not.toHaveText('₹0.00');

    await page.getByTestId('button-checkout').click();
    await expect(page).toHaveURL(/\/orders$/, { timeout: 15000 });
  }

  test('one-time: adds a product, reviews the cart, and places an order', async ({
    page,
  }) => {
    await loginAndPrepare(page);

    // Home: wait for the product grid, then open the first product.
    const grid = page.getByTestId('product-grid');
    await expect(grid).toBeVisible();
    const firstCard = grid.locator('> *').first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // Product modal opens on one-time delivery by default for a product with
    // no subscription; add it to the cart.
    const addBtn = page.getByTestId('button-add-to-cart-modal');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    // Header cart count reflects the add (persistent signal, not the transient
    // toast). AnimatePresence can briefly render both the old and new spans, so
    // match by text.
    await expect(
      page.getByTestId('text-cart-count').filter({ hasText: '1 item' }),
    ).toBeVisible();

    // Close the modal (Escape — the custom close button sits behind the Radix
    // overlay) and check out.
    await page.keyboard.press('Escape');
    await expect(addBtn).toBeHidden();
    await reviewCartAndCheckout(page);
  });

  test('subscription: subscribes to Milk and places the order', async ({
    page,
  }) => {
    await loginAndPrepare(page);

    // Open Milk directly by its (seeded) product id — a subscription-enabled
    // product. Its modal opens in subscription mode by default. Targeting the
    // card by id avoids depending on grid order or the debounced search.
    const MILK_ID = '00000000-0000-0000-0000-000000000001';
    await expect(page.getByTestId('product-grid')).toBeVisible();
    await page.getByTestId(`product-card-${MILK_ID}`).click();

    // The modal loads product detail async; the subscription plan controls
    // appear once it resolves. Pick the 15-delivery plan and daily frequency
    // (start date defaults to tomorrow).
    await page.getByTestId('duration-15').click({ timeout: 10000 });
    await page.getByTestId('frequency-daily').click();

    const subscribeBtn = page.getByTestId('button-add-to-cart-modal');
    await expect(subscribeBtn).toHaveText(/Subscribe/);
    await subscribeBtn.click();

    // Subscription add closes the modal itself; confirm the cart populated.
    await expect(
      page.getByTestId('text-cart-count').filter({ hasText: /item/ }),
    ).toBeVisible();

    // Cart should show the subscription badge, then check out.
    await page.goto('/cart');
    await expect(page.getByText('Subscription').first()).toBeVisible();
    await reviewCartAndCheckout(page);
  });
});
