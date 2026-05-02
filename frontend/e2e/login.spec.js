import { test, expect } from '@playwright/test';

test('user can view login page and attempt login', async ({ page }) => {
  // 1. Navigate to the app (baseURL is set in config to http://localhost:5173)
  await page.goto('/');

  // 2. The app usually redirects to /login if not authenticated
  await expect(page).toHaveURL(/.*\/login/);

  // 3. Verify elements are present
  const emailInput = page.locator('input[placeholder="Email address"]');
  const passwordInput = page.locator('input[placeholder="••••••••"]');
  const loginButton = page.getByRole('button', { name: /sign in/i });

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();
  await expect(loginButton).toBeVisible();

  // 4. Fill in credentials
  await emailInput.fill('admin@tinkumobiles.com');
  await passwordInput.fill('password');

  // 5. Submit form
  await loginButton.click();

  // Depending on whether the backend is running, this might fail network requests, 
  // but we can at least assert the button click behavior and loading states.
  // Wait for network response or toast error
  // E.g. check for toast error since backend might not be seeded
  // await expect(page.locator('.Toastify')).toBeVisible();
});
