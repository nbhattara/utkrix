import { test, expect } from '@playwright/test';

test.describe('Login Frontend (login.abc.com)', () => {
  test.use({ baseURL: 'http://localhost:5174' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect to login page', async ({ page }) => {
    expect(page.url()).toContain('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should have UtkriX Technologies branding', async ({ page }) => {
    const title = page.locator('h1, h2').filter({ hasText: /UTKRIX/i });
    await expect(title.first()).toBeVisible();
  });

  test('should display remember me checkbox', async ({ page }) => {
    const rememberCheckbox = page.locator('input[type="checkbox"]');
    await expect(rememberCheckbox).toBeVisible();
  });

  test('should toggle remember me checkbox', async ({ page }) => {
    const rememberCheckbox = page.locator('input[type="checkbox"]');
    const isChecked = await rememberCheckbox.isChecked();

    await rememberCheckbox.check();
    await expect(rememberCheckbox).toBeChecked();

    await rememberCheckbox.uncheck();
    await expect(rememberCheckbox).not.toBeChecked();
  });

  test('should have forgot password link', async ({ page }) => {
    const forgotLink = page.locator('a[href*="forgot-password"]');
    await expect(forgotLink).toBeVisible();
  });

  test('should navigate to forgot password page', async ({ page }) => {
    const forgotLink = page.locator('a[href*="forgot-password"]');
    await forgotLink.click();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('forgot-password');
  });

  test('should navigate to register page', async ({ page }) => {
    const registerLink = page.locator('a[href*="register"]');
    await registerLink.click();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('register');
  });

  test('should show validation for empty email', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    const emailInput = page.locator('input[type="email"]');

    await emailInput.fill('');
    await submitButton.click();

    // Browser HTML5 validation
    await expect(emailInput).toHaveAttribute('required');
  });

  test('should show validation for empty password', async ({ page }) => {
    const submitButton = page.locator('button[type="submit"]');
    const passwordInput = page.locator('input[type="password"]');

    await passwordInput.fill('');
    await submitButton.click();

    await expect(passwordInput).toHaveAttribute('required');
  });

  test('should validate email format', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('invalid-email');

    const isValid = await emailInput.evaluate((input) => input.checkValidity());
    expect(isValid).toBe(false);
  });

  test('should accept valid email format', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');

    const isValid = await emailInput.evaluate((input) => input.checkValidity());
    expect(isValid).toBe(true);
  });
});

test.describe('Login Frontend - Register Page', () => {
  test.use({ baseURL: 'http://localhost:5174' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display registration form', async ({ page }) => {
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should have terms and conditions checkbox', async ({ page }) => {
    const termsCheckbox = page.locator('input[type="checkbox"]');
    await expect(termsCheckbox).toBeVisible();
  });

  test('should require terms acceptance', async ({ page }) => {
    const termsCheckbox = page.locator('input[type="checkbox"]');
    await expect(termsCheckbox).toHaveAttribute('required');
  });

  test('should have password confirmation field', async ({ page }) => {
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(2);
  });

  test('should navigate back to login', async ({ page }) => {
    const loginLink = page.locator('a[href*="login"]');
    await loginLink.click();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('login');
  });
});

test.describe('Login Frontend - Forgot Password Page', () => {
  test.use({ baseURL: 'http://localhost:5174' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/forgot-password');
  });

  test('should display email input', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should have back to login link', async ({ page }) => {
    const loginLink = page.locator('a[href*="login"]');
    await expect(loginLink).toBeVisible();
  });

  test('should navigate back to login', async ({ page }) => {
    const loginLink = page.locator('a[href*="login"]');
    await loginLink.click();
    await page.waitForLoadState('networkidle');

    expect(page.url()).toContain('login');
  });
});

test.describe('Login Frontend - Responsive Design', () => {
  test.use({ baseURL: 'http://localhost:5174' });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/login');

    const form = page.locator('form');
    await expect(form).toBeVisible();
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/login');

    const form = page.locator('form');
    await expect(form).toBeVisible();
  });

  test('should be responsive on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/login');

    const form = page.locator('form');
    await expect(form).toBeVisible();
  });
});
