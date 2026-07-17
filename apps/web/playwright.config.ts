import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for LeAd web E2E.
 *
 * Local:
 *   1. supabase start && supabase db reset
 *   2. API on :8000, web on :3000
 *   3. npx playwright test (from apps/web)
 *
 * Seed credentials (seed.sql): client@lead.ai / Password123!
 */
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
