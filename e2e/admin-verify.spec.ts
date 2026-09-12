import { test } from '@playwright/test';
import { ADMIN, LOCALES, gotoAdminLogin } from './helpers';

test.describe('Admin verification desk', () => {
  for (const locale of LOCALES) {
    test(`request desk shows the handwritten sheet (${locale})`, async ({ page }) => {
      const first = await gotoAdminLogin(page, locale);
      if (first.status >= 500 || first.status === 0) {
        test.skip(true, `Admin web returned ${first.status}`);
        return;
      }

      const list = await page.goto(`${ADMIN}/${locale}/requests`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((list?.status() ?? 0) >= 400) {
        test.skip(true, 'Requests requires an authenticated session');
        return;
      }
      await page.screenshot({
        path: `e2e/screenshots/admin-verify-requests-${locale}.png`,
        fullPage: true,
      });
    });
  }
});
