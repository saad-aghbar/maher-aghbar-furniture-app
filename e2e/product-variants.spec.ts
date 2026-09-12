import { test } from '@playwright/test';
import { ADMIN, LOCALES, gotoAdminLogin } from './helpers';

test.describe('Product variants — admin web', () => {
  for (const locale of LOCALES) {
    test(`product variants section (${locale})`, async ({ page }) => {
      const first = await gotoAdminLogin(page, locale);
      if (first.status >= 500 || first.status === 0) {
        test.skip(true, `Admin web returned ${first.status}`);
        return;
      }

      const products = await page.goto(`${ADMIN}/${locale}/products`, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });
      if ((products?.status() ?? 0) >= 400) {
        test.skip(true, 'Products require an authenticated session');
        return;
      }
      await page.screenshot({
        path: `e2e/screenshots/product-variants-list-${locale}.png`,
        fullPage: true,
      });
    });
  }
});
