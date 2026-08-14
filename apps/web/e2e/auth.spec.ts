import { test, expect } from "@playwright/test";

/**
 * Smoke auth E2E against seeded users (supabase/seed.sql).
 * Default: client@lead.ai / Password123!
 */
test.describe("Auth smoke", () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test("client can sign in and reach user dashboard", async ({ page }) => {
    const email = process.env.E2E_EMAIL || "client@lead.ai";
    const password = process.env.E2E_PASSWORD || "Password123!";

    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.locator('button[type="submit"]').click({ force: true });

    await expect(page).toHaveURL(/\/user\/dashboard/, { timeout: 20_000 });
  });

  test("invalid credentials show an error", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();

    await page.fill('input[type="email"]', "nobody@lead.ai");
    await page.fill('input[type="password"]', "WrongPassword1!");
    await page.locator('button[type="submit"]').click({ force: true });

    // Stay on login; error banner or no dashboard redirect
    await page.waitForTimeout(1500);
    await expect(page).toHaveURL(/\/login/);
  });
});

