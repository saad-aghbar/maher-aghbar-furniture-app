import { expect, test, type Page } from '@playwright/test';

const WEB = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://127.0.0.1:3000';

test.use({
  channel: 'chrome',
  launchOptions: { args: ['--guest'] },
});

async function fillControlled(page: Page, autocomplete: string, value: string) {
  const input = page.locator(`input[autocomplete="${autocomplete}"]`);
  await input.waitFor({ state: 'visible' });
  await input.click();
  await input.fill('');
  await input.evaluate((el, next) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

test.describe('unified web auth matrix', () => {
  test('logged-out admin desk is sent to an auth surface', async ({ page, context }) => {
    await context.clearCookies();
    const res = await page.goto(`${WEB}/en/admin/dashboard`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    });
    expect(res?.status() ?? 0).toBeLessThan(400);
    await expect(page).toHaveURL(/\/en\/(login|session-expired)/);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('forgot-password and session-expired surfaces render', async ({ page }) => {
    for (const path of ['forgot-password', 'session-expired', 'disabled', 'mfa']) {
      const res = await page.goto(`${WEB}/en/${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      expect(res?.status() ?? 0, path).toBeLessThan(400);
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('dealer cannot open admin dashboard', async ({ page }) => {
    await page.goto(`${WEB}/en/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await fillControlled(page, 'username', 'nile');
    await fillControlled(page, 'current-password', '123');
    const loginResponse = page.waitForResponse(
      (res) => res.url().includes('/api/v1/auth/login') && res.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.locator('form button[type="submit"]').click();
    expect((await loginResponse).ok()).toBeTruthy();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 });
    await page.goto(`${WEB}/en/admin/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await expect(page.locator('body')).toContainText(/disabled|forbidden|home|الرئيسية|בית|no results/i);
  });
});
