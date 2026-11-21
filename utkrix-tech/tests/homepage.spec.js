import { test, expect } from '@playwright/test';

test.describe('Homepage Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/UtkriX/);
    await expect(page.locator('main')).toBeVisible();
  });

  test('should display header with navigation', async ({ page }) => {
    const header = page.locator('header');
    await expect(header).toBeVisible();

    const navItems = page.locator('nav a');
    await expect(navItems.first()).toBeVisible();
  });

  test('should display hero section', async ({ page }) => {
    const hero = page.locator('#home, .hero');
    await expect(hero).toBeVisible();
  });

  test('should display services section', async ({ page }) => {
    await page.locator('#services').scrollIntoViewIfNeeded();
    const services = page.locator('#services');
    await expect(services).toBeVisible();
  });

  test('should display stats section', async ({ page }) => {
    await page.locator('.stats').scrollIntoViewIfNeeded();
    const stats = page.locator('.stats');
    await expect(stats).toBeVisible();
  });

  test('should display about section', async ({ page }) => {
    await page.locator('#about').scrollIntoViewIfNeeded();
    const about = page.locator('#about');
    await expect(about).toBeVisible();
  });

  test('should display courses section', async ({ page }) => {
    await page.locator('#courses').scrollIntoViewIfNeeded();
    const courses = page.locator('#courses');
    await expect(courses).toBeVisible();
  });

  test('should display projects section', async ({ page }) => {
    await page.locator('#projects').scrollIntoViewIfNeeded();
    const projects = page.locator('#projects');
    await expect(projects).toBeVisible();
  });

  test('should display contact section', async ({ page }) => {
    await page.locator('#contact').scrollIntoViewIfNeeded();
    const contact = page.locator('#contact');
    await expect(contact).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
  });

  test('should have working navigation links', async ({ page }) => {
    const firstNavLink = page.locator('nav a').first();
    const href = await firstNavLink.getAttribute('href');

    await firstNavLink.click();
    await page.waitForLoadState('networkidle');

    // Verify hash navigation
    expect(page.url()).toContain(href);
  });

  test('should display theme toggle button', async ({ page }) => {
    const themeToggle = page.locator('[aria-label*="theme"], button[class*="theme"]');
    await expect(themeToggle).toBeVisible();
  });

  test('should toggle theme when clicked', async ({ page }) => {
    const themeToggle = page.locator('[aria-label*="theme"], button[class*="theme"]');

    const initialColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });

    await themeToggle.click();
    await page.waitForTimeout(100);

    const newColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });

    // Theme should change
    expect(initialColor).not.toBe(newColor);
  });
});
