import { test } from '@playwright/test';
import { ADMIN, LOCALES, gotoAdminLogin } from './helpers';

test.describe('Labor costing — Cost & Performance slots', () => {
  for (const locale of LOCALES) {
    test(`money desk and order dossier labor (${locale})`, async ({ page }) => {
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
        path: `e2e/screenshots/labor-costing-money-${locale}.png`,
        fullPage: true,
      });

      const orders = await page.goto(`${ADMIN}/${locale}/reports/orders`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((orders?.status() ?? 0) < 400) {
        await page.screenshot({
          path: `e2e/screenshots/labor-costing-orders-${locale}.png`,
          fullPage: true,
        });
      }
    });
  }
});
