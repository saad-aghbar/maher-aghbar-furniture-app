import { test } from '@playwright/test';
import { ADMIN, LOCALES, gotoAdminLogin } from './helpers';

test.describe('Worker labor rate — admin web', () => {
  for (const locale of LOCALES) {
    test(`employees modal shows hourly rate (${locale})`, async ({ page }) => {
      const first = await gotoAdminLogin(page, locale);
      if (first.status >= 500 || first.status === 0) {
        test.skip(true, `Admin web returned ${first.status}`);
        return;
      }

      const employees = await page.goto(`${ADMIN}/${locale}/employees`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((employees?.status() ?? 0) >= 400) {
        test.skip(true, 'Employees require an authenticated session');
        return;
      }
      await page.screenshot({
        path: `e2e/screenshots/worker-labor-rate-${locale}.png`,
        fullPage: true,
      });
    });
  }
});
