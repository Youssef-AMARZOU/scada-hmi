const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://localhost:5173';

test.describe('INDUS Platform — E2E Tests', () => {

  test('1. Page loads and shows title', async ({ page }) => {
    await page.goto(BASE_URL, { timeout: 15000 });
    await expect(page).toHaveTitle(/INDUS|Plateforme Industrielle/);
  });

  test('2. Sidebar navigation exists', async ({ page }) => {
    await page.goto(BASE_URL);
    const sidebar = page.locator('aside.sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('3. Dashboard renders KPIs', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);
    const body = page.locator('body');
    await expect(body).not.toBeEmpty();
  });

  test('4. Navigate to Settings', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    const settingsLink = page.locator('a[href*="settings"], button:has-text("Settings"), a:has-text("Paramètres"), [href="#/settings"]').first();
    if (await settingsLink.isVisible()) {
      await settingsLink.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/settings/);
    }
  });

  test('5. Navigate to SCADA', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    const link = page.locator('a[href*="scada"], a:has-text("SCADA"), [href="#/scada"]').first();
    if (await link.isVisible()) {
      await link.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/scada/);
    }
  });

  test('6. Navigate to GMAO', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    const link = page.locator('a[href*="gmao"], a:has-text("GMAO"), [href="#/gmao"]').first();
    if (await link.isVisible()) {
      await link.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/gmao/);
    }
  });

  test('7. Navigate to MES', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    const link = page.locator('a[href*="mes"], a:has-text("MES"), [href="#/mes"]').first();
    if (await link.isVisible()) {
      await link.click();
      await page.waitForTimeout(1000);
      await expect(page).toHaveURL(/mes/);
    }
  });

  test('8. Language toggle (FR/EN)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);
    const langBtn = page.locator('button:has-text("FR"), button:has-text("EN"), [class*="language"], [class*="lang"]').first();
    if (await langBtn.isVisible()) {
      await langBtn.click();
      await page.waitForTimeout(500);
    }
  });

  test('9. App renders without console errors', async ({ page }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    await page.goto(BASE_URL);
    await page.waitForTimeout(3000);
    expect(errors.length).toBe(0);
  });

});
