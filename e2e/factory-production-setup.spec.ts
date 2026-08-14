import { test, expect } from '@playwright/test';

const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:4000';

async function attachAdminSession(page: {
  request: { post: Function };
}) {
  const loginRes = await page.request.post(`${API}/api/v1/auth/login`, {
    data: { username: 'admin', password: '123' },
  });
  expect(loginRes.ok()).toBeTruthy();
}

async function uatSofaAId(page: { request: { get: Function } }) {
  const products = await page.request.get(`${API}/api/v1/products?pageSize=50&q=UAT-SOFA-A`);
  const rows = (await products.json())?.data ?? [];
  return rows.find((p: { sku?: string }) => p.sku === 'UAT-SOFA-A')?.id as string | undefined;
}

test.describe('Factory Production Setup UI', () => {
  test('admin web EN shows Production Setup without raw enums', async ({ page }) => {
    await attachAdminSession(page);
    const productId = await uatSofaAId(page);
    test.skip(!productId, 'UAT-SOFA-A fixture missing');

    await page.goto(`${ADMIN}/en/products/${productId}`, { waitUntil: 'networkidle' });
    await expect(page.getByText(/production setup|إعداد الإنتاج|הגדרת ייצור/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/ready|جاهز|מוכן/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /edit materials|تعديل المواد|עריכת חומרים/i })).toBeVisible();
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/PRODUCES_SEMI_FINISHED/);
    expect(body).not.toMatch(/\bNEEDS_SETUP\b/);
    expect(body).not.toMatch(/production\.setup\./);
  });

  test('AR locale is RTL and localizes the hub', async ({ page }) => {
    await page.goto(`${ADMIN}/ar/login`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await attachAdminSession(page);
    const productId = await uatSofaAId(page);
    test.skip(!productId, 'UAT-SOFA-A fixture missing');
    await page.goto(`${ADMIN}/ar/products/${productId}`, { waitUntil: 'networkidle' });
    await expect(page.getByText('إعداد الإنتاج').first()).toBeVisible({ timeout: 20_000 });
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/PRODUCES_SEMI_FINISHED/);
  });

  test('HE locale is RTL and uses Hebrew preview names when present', async ({ page }) => {
    await page.goto(`${ADMIN}/he/login`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await attachAdminSession(page);
    const productId = await uatSofaAId(page);
    test.skip(!productId, 'UAT-SOFA-A fixture missing');
    await page.goto(`${ADMIN}/he/products/${productId}`, { waitUntil: 'networkidle' });
    await expect(page.getByText('הגדרת ייצור').first()).toBeVisible({ timeout: 20_000 });
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/PRODUCES_SEMI_FINISHED/);
    expect(body).not.toMatch(/production\.setup\./);
    await expect(page.getByText('נגרות').first()).toBeVisible();
    await expect(page.getByText(/שלדת ספת UAT רגילה/).first()).toBeVisible();
  });
});
