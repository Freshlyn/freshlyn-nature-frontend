import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

// Load test-only secrets (e.g. SUPABASE_SERVICE_ROLE_KEY) from an untracked
// file so the auth spec can read OTPs back from the database. Falls back to
// the process environment when the file is absent (CI).
dotenv.config({ path: '.env.test.local' });

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Real-auth specs hit a live Supabase backend that can occasionally
  // rate-limit or lag on concurrent user creation; one retry absorbs those
  // transient hiccups without serializing the whole suite.
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Reuse a running dev server locally; start one in CI.
  webServer: {
    command: 'npm run dev -- --port ' + PORT + ' --strictPort',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
