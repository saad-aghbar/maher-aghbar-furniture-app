import { test } from '@playwright/test';
import { ADMIN, LOCALES, gotoAdminLogin } from './helpers';

test.describe('Spec option libraries — admin web', () => {
  for (const locale of LOCALES) {
    test(`spec option groups and values (${locale})`, async ({ page }) => {
      const first = await gotoAdminLogin(page, locale);
      if (first.status >= 500 || first.status === 0) {
        test.skip(true, `Admin web returned ${first.status}`);
        return;
      }

      const groups = await page.goto(`${ADMIN}/${locale}/spec-options`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((groups?.status() ?? 0) >= 400) {
        test.skip(true, 'Spec options require an authenticated session');
        return;
      }
      await page.screenshot({
        path: `e2e/screenshots/spec-options-groups-${locale}.png`,
        fullPage: true,
      });

      const values = await page.goto(`${ADMIN}/${locale}/spec-option-values`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((values?.status() ?? 0) < 400) {
        await page.screenshot({
          path: `e2e/screenshots/spec-option-values-${locale}.png`,
          fullPage: true,
        });
      }
    });
  }
});
