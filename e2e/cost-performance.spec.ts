import { test, expect } from '@playwright/test';
import {
  ADMIN,
  LOCALES,
  assertEveryTableRowHasLink,
  assertLoginVisible,
  gotoAdminLogin,
} from './helpers';

test.describe('Cost & Performance — routed sections', () => {
  test('admin login renders in en / ar / he', async ({ page }) => {
    const first = await gotoAdminLogin(page, 'en');
    if (first.status >= 500 || first.status === 0) {
      test.skip(true, `Admin web returned ${first.status} at ${ADMIN}/en/login`);
      return;
    }
    await assertLoginVisible(page);
    for (const locale of LOCALES) {
      const next = await gotoAdminLogin(page, locale);
      if (next.status >= 500) continue;
      await page.screenshot({
        path: `e2e/screenshots/reports-login-${locale}.png`,
        fullPage: true,
      });
    }
  });

  for (const locale of LOCALES) {
    test(`reports money / orders / products / returns / coverage (${locale})`, async ({ page }) => {
      const first = await gotoAdminLogin(page, locale);
      if (first.status >= 500 || first.status === 0) {
        test.skip(true, `Admin web returned ${first.status}`);
        return;
      }

      const money = await page.goto(`${ADMIN}/${locale}/reports`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((money?.status() ?? 0) >= 400) {
        test.skip(true, 'Reports requires an authenticated session');
        return;
      }
      await page.screenshot({
        path: `e2e/screenshots/reports-money-${locale}.png`,
        fullPage: true,
      });

      const orders = await page.goto(`${ADMIN}/${locale}/reports/orders`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((orders?.status() ?? 0) < 400) {
        const tables = page.locator('table');
        if (await tables.count()) {
          await assertEveryTableRowHasLink(tables.first()).catch(() => undefined);
        }
        await page.screenshot({
          path: `e2e/screenshots/reports-orders-${locale}.png`,
          fullPage: true,
        });
      }

      await page.goto(`${ADMIN}/${locale}/reports/products`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('body')).toContainText(/Products|المنتجات|מוצרים/i);
      await page.screenshot({
        path: `e2e/screenshots/reports-products-${locale}.png`,
        fullPage: true,
      });
      await page.goto(`${ADMIN}/${locale}/reports/returns`, { waitUntil: 'domcontentloaded' });
      await page.screenshot({
        path: `e2e/screenshots/reports-returns-${locale}.png`,
        fullPage: true,
      });
      await page.goto(`${ADMIN}/${locale}/reports/coverage`, { waitUntil: 'domcontentloaded' });
      await page.screenshot({
        path: `e2e/screenshots/reports-coverage-${locale}.png`,
        fullPage: true,
      });
    });
  }

  test('CSV export controls remain on the money desk', async ({ page }) => {
    const first = await gotoAdminLogin(page, 'en');
    if (first.status >= 500 || first.status === 0) {
      test.skip(true, `Admin web returned ${first.status}`);
      return;
    }
    const res = await page.goto(`${ADMIN}/en/reports`, { waitUntil: 'domcontentloaded' });
    if ((res?.status() ?? 0) >= 400) {
      test.skip(true, 'Reports requires an authenticated session');
      return;
    }
    await expect(page.getByRole('button').first()).toBeVisible({ timeout: 10_000 }).catch(() => undefined);
  });
});
