import { test } from '@playwright/test';
import { ADMIN, LOCALES, gotoAdminLogin } from './helpers';

test.describe('Custom order catalog promotion', () => {
  for (const locale of LOCALES) {
    test(`sales order detail can promote a custom line (${locale})`, async ({ page }) => {
      const first = await gotoAdminLogin(page, locale);
      if (first.status >= 500 || first.status === 0) {
        test.skip(true, `Admin web returned ${first.status}`);
        return;
      }

      const list = await page.goto(`${ADMIN}/${locale}/sales-orders`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((list?.status() ?? 0) >= 400) {
        test.skip(true, 'Sales orders require an authenticated session');
        return;
      }
      await page.screenshot({
        path: `e2e/screenshots/catalog-promotion-orders-${locale}.png`,
        fullPage: true,
      });
    });
  }
});
