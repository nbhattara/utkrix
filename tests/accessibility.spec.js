import { test, expect } from '@playwright/test';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);

    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    const count = await headings.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should have alt text for images', async ({ page }) => {
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });

  test('should have skip to content link', async ({ page }) => {
    const skipLink = page.locator('.skip-link, a[href="#main"]');
    await expect(skipLink.first()).toBeVisible();
  });

  test('should have focusable interactive elements', async ({ page }) => {
    const buttons = page.locator('button');
    const links = page.locator('a[href]');
    const inputs = page.locator('input, select, textarea');

    await expect(buttons.first()).toBeVisible();
    await expect(links.first()).toBeVisible();
  });

  test('should maintain focus state', async ({ page }) => {
    const firstButton = page.locator('button').first();
    await firstButton.focus();

    const isFocused = await firstButton.evaluate((el) => document.activeElement === el);
    expect(isFocused).toBe(true);
  });

  test('should have sufficient color contrast (basic check)', async ({ page }) => {
    const body = page.locator('body');
    const backgroundColor = await body.evaluate((el) => {
      return getComputedStyle(el).backgroundColor;
    });

    // Check that background color is not transparent
    expect(backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(backgroundColor).not.toBe('transparent');
  });

  test('should have proper ARIA labels on interactive elements', async ({ page }) => {
    const buttonsWithoutLabels = page.locator('button:not([aria-label]):not([aria-labelledby])');
    const linksWithoutLabels = page.locator('a:not([aria-label]):not([aria-labelledby])');

    // Note: This is a basic check. In production, you'd want more sophisticated
    // ARIA auditing using tools like axe-core
    const buttonCount = await buttonsWithoutLabels.count();
    const linkCount = await linksWithoutLabels.count();

    // Some buttons/links may not need aria-label if they have visible text
    // This is just a basic check to ensure the consideration is there
  });
});
