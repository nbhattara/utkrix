import { test, expect } from '@playwright/test';

// Auth UI lives on the login subdomain app (see login-frontend.spec.js).
// The main site must never render sign-in/registration and must redirect
// auth routes to the centralized login app.
const LOGIN_URL = process.env.VITE_LOGIN_URL || 'http://login.lvh.me:5173';

test.describe('Centralized auth redirects', () => {
  test('landing page has no sign-in or create-account links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('header a', { hasText: 'Sign in' })).toHaveCount(0);
    await expect(page.locator('header a', { hasText: 'Create account' })).toHaveCount(0);
  });

  for (const route of ['login', 'register', 'forgot-password']) {
    test(`#/${route} redirects to the login app`, async ({ page }) => {
      await page.goto(`/#/${route}`);
      await page.waitForURL((url) => url.origin === new URL(LOGIN_URL).origin, { timeout: 10000 });
      expect(page.url()).toContain(new URL(LOGIN_URL).pathname === '/' ? '/login' : '');
    });
  }

  test('dashboard route redirects to the employee portal', async ({ page }) => {
    await page.goto('/#/dashboard');
    await page.waitForURL((url) => url.pathname === '/' && url.hostname.startsWith('employees.'), { timeout: 10000 });
  });
});
