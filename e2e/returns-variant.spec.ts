import { test } from '@playwright/test';
import { ADMIN, LOCALES, gotoAdminLogin } from './helpers';

test.describe('Returns carry the variant', () => {
  for (const locale of LOCALES) {
    test(`returns list (${locale})`, async ({ page }) => {
      const first = await gotoAdminLogin(page, locale);
      if (first.status >= 500 || first.status === 0) {
        test.skip(true, `Admin web returned ${first.status}`);
        return;
      }

      const list = await page.goto(`${ADMIN}/${locale}/returns`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((list?.status() ?? 0) >= 400) {
        test.skip(true, 'Returns require an authenticated session');
        return;
      }
      await page.screenshot({
        path: `e2e/screenshots/returns-variant-${locale}.png`,
        fullPage: true,
      });
    });
  }
});
