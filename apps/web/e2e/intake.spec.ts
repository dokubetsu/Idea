import { test, expect } from "@playwright/test";

/**
 * E2E: Petitioner Intake Wizard — full happy path
 *
 * FIX C: Rewrote to match the current IntakeWizard flow:
 *   domain tile → core facts → category facts → describe → assessment → confirm → done
 *
 * Prerequisites:
 *   - A user account exists: client@lead.ai / password123
 *   - The API + Supabase are running (see README for local setup)
 *   - At least one AI provider (or mock) is configured
 */

test.describe("Petitioner Intake Wizard — E2E", () => {
  test("should complete the full wizard and create a matter", async ({ page }) => {
    // 1. Login
    await page.goto("http://localhost:3000/login");
    await expect(page).toHaveTitle(/Login/i);

    await page.fill('input[type="email"]', "client@lead.ai");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    // 2. Confirm redirect to user dashboard
    await expect(page).toHaveURL(/\/user\/dashboard/, { timeout: 10000 });

    // 3. Open the intake wizard
    await page.click('button:has-text("Start New Case"), a:has-text("Start New Case")');
    await expect(page.locator('h2:has-text("Choose a legal domain")')).toBeVisible({ timeout: 5000 });

    // ── Step 1: Pick domain ───────────────────────────────
    // Click the "Consumer" domain tile
    await page.click('button:has-text("Consumer")');

    // ── Step 1.5: Pick subtype ────────────────────────────
    await expect(page.locator('h2:has-text("Select the type of dispute")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Product Defect")');

    // ── Step 2: Core facts ─────────────────────────────────────────
    await expect(page.locator('h2:has-text("A few quick details")')).toBeVisible({ timeout: 5000 });

    // Fill incident date
    await page.fill('input[type="date"]', "2026-05-15");

    // Incident location
    await page.fill('input[placeholder*="city"]', "Mumbai, Maharashtra");

    // Opponent name
    await page.fill('input[placeholder*="party"]', "Amazon India");

    // Urgency: pick "I need help soon"
    await page.click('label:has-text("I need help soon")');

    // Prior legal action: No
    await page.click('label:has-text("No")');

    await page.click('button[type="submit"]:has-text("Continue")');

    // ── Step 3: Category-specific facts ───────────────────────────
    await expect(page.locator('h2:has-text("Tell us more")')).toBeVisible({ timeout: 5000 });
    // Fill the product/service field
    await page.fill('input[placeholder*="Refrigerator"]', "Laptop — Faulty keyboard on delivery");
    // Fill purchase amount
    const amountInput = page.locator('input[type="number"]').first();
    await amountInput.fill("75000");
    // Company name
    const textInputs = page.locator('input[type="text"]');
    await textInputs.nth(1).fill("Amazon");
    // "Have you complained?" — click Yes
    await page.click('label:has-text("Yes")');

    await page.click('button:has-text("Continue")');

    // ── Step 4: Describe / title ───────────────────────────────────
    await expect(page.locator('h2:has-text("Anything else")')).toBeVisible({ timeout: 5000 });
    await page.fill('input[placeholder*="e.g."]', "Defective laptop — Amazon not responding");
    // Submit to trigger AI assessment (may take up to 20 s in CI with mock provider)
    await page.click('button:has-text("Get my assessment")');

    // ── Step 5: Assessment results ─────────────────────────────────
    await expect(page.locator('h2:has-text("Your legal assessment")')).toBeVisible({ timeout: 30000 });
    // Confirm key assessment cards are present
    await expect(page.locator('text=Chance of success')).toBeVisible();
    await expect(page.locator('text=Estimated timeline')).toBeVisible();
    await expect(page.locator('text=What to do next')).toBeVisible();

    // ── Step 6: Confirm ────────────────────────────────────────────
    await page.click('button:has-text("Create my case file")');
    await expect(page.locator('h2:has-text("Confirm and create")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Confirm and create case")');

    // ── Step 7: Done ───────────────────────────────────────────────
    await expect(page.locator('h3:has-text("Your case is created")')).toBeVisible({ timeout: 15000 });
    // "View my case" should link to /user/matters/[id]
    const viewBtn = page.locator('button:has-text("View my case"), a:has-text("View my case")');
    await expect(viewBtn).toBeVisible();
  });
});
