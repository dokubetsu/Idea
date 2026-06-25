import { test, expect } from "@playwright/test";

test.describe("Petitioner Intake & Commit E2E Workflow", () => {
  test("should complete the intake wizard and commit a new matter successfully", async ({ page }) => {
    // 1. Visit Login page
    await page.goto("http://localhost:3000/login");
    await expect(page).toHaveTitle(/Login/);

    // 2. Fill login credentials
    await page.fill('input[type="email"]', "client@lead.ai");
    await page.fill('input[type="password"]', "password123");
    await page.click('button[type="submit"]');

    // 3. Confirm redirected to dashboard
    await expect(page).toHaveURL(/.*\/user\/dashboard/);
    await expect(page.locator("h1")).toContainText("Hello");

    // 4. Click "Start intake" to launch the wizard
    await page.click('text="Start intake"');
    await expect(page).toHaveURL(/.*\/user\/matters/);

    // 5. Fill out the intake wizard description
    await page.fill('input[placeholder="Enter a brief title"]', "Unpaid salary claim");
    await page.fill('textarea[placeholder="Explain what happened in detail"]', 
      "I was employed at Acme Corp for 6 months. They suddenly terminated my employment without notice on May 15, 2026, and have refused to pay my final month salary of 50000 rupees despite multiple email requests."
    );
    await page.click('button:has-text("Submit details")');

    // 6. Wait for facts extraction and review screen
    await expect(page.locator("text=Review Extracted Facts")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=property_value")).toBeVisible();

    // 7. Click next / confirm facts
    await page.click('button:has-text("Confirm facts")');

    // 8. Wait for AI Legal Assessment output
    await expect(page.locator("text=Legal Assessment")).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=Success Probability")).toBeVisible();

    // 9. Commit and create the matter
    await page.click('button:has-text("Create Legal Matter")');

    // 10. Verify matter is active on the dashboard
    await expect(page).toHaveURL(/.*\/user\/dashboard/);
    await expect(page.locator("text=Matter created successfully")).toBeVisible();
  });
});
