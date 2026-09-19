import { expect, test, type Page } from '@playwright/test';

test.use({
  channel: 'chrome',
  launchOptions: {
    args: ['--guest'],
  },
});

const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';
const CUSTOMER = process.env.NEXT_PUBLIC_WEB_URL ?? process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';
const EMPLOYEE = process.env.NEXT_PUBLIC_WEB_URL ?? process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:4000';

const LOCALES = ['ar', 'en', 'he'] as const;

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

async function loginPortal(page: Page, origin: string, locale: string, username: string) {
  await page.goto(`${origin}/${locale}/login`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await fillControlled(page, 'username', username);
  await fillControlled(page, 'current-password', '123');
  const loginResponse = page.waitForResponse(
    (res) => res.url().includes('/api/v1/auth/login') && res.request().method() === 'POST',
    { timeout: 20_000 },
  );
  await page.locator('form').locator('button[type="submit"]').click();
  const res = await loginResponse;
  expect(res.ok(), `login ${username} on ${origin}/${locale}`).toBeTruthy();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45_000 });
}

async function assertPageOk(page: Page, url: string) {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const status = res?.status() ?? 0;
  expect(status, url).toBeLessThan(400);
  await expect(page.locator('body')).not.toContainText('Application error');
  await expect(page.locator('input[autocomplete="username"]')).toHaveCount(0);
}

async function apiLogin(username: string) {
  const res = await fetch(`${API}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: '123', client: 'mobile' }),
  });
  if (!res.ok) throw new Error(`login ${username} ${res.status}`);
  const body = (await res.json()) as { accessToken: string };
  return body.accessToken;
}

async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return (await res.json()) as T;
}

test.describe('Web parity walk — login locales', () => {
  for (const locale of LOCALES) {
    test(`login shells ${locale}`, async ({ page }) => {
      for (const origin of [ADMIN, CUSTOMER, EMPLOYEE]) {
        const res = await page.goto(`${origin}/${locale}/login`, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000,
        });
        expect(res?.status() ?? 0, `${origin}/${locale}/login`).toBe(200);
        const dir = await page.locator('html').getAttribute('dir');
        expect(dir).toBe(locale === 'en' ? 'ltr' : 'rtl');
        await expect(page.locator('form button[type="submit"]')).toBeVisible();
      }
    });
  }
});

test.describe('Web parity walk — authenticated desks', () => {
  test('admin ar/en/he new routes + golden production-plan', async ({ page }) => {
    test.setTimeout(10 * 60_000);
    const token = await apiLogin('admin');
    const sos = await apiGet<{ data: Array<{ id: string; number: string }> }>(
      '/api/v1/sales-orders?q=SO-2026-00026&pageSize=1',
      token,
    );
    const goldenId = sos.data?.[0]?.id;
    expect(goldenId).toBeTruthy();
    const items = await apiGet<{ data: Array<{ id: string }> }>(
      '/api/v1/reports/cost/inventory/items?pageSize=1',
      token,
    );
    const itemId = items.data?.[0]?.id;
    const products = await apiGet<{ data: Array<{ id: string }> }>(
      '/api/v1/reports/cost/products?pageSize=1',
      token,
    );
    const productId = products.data?.[0]?.id;

    for (const locale of LOCALES) {
      await loginPortal(page, ADMIN, locale, 'admin');
      await assertPageOk(page, `${ADMIN}/${locale}/admin/production`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/sales-orders/${goldenId}/production-plan`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/inventory`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/inventory/receive`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/inventory/low-stock`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/purchasing/fabric`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/reports`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/reports/inventory`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/reports/products/custom`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/reports/coverage/MISSING_PRICE`);
      if (itemId) await assertPageOk(page, `${ADMIN}/${locale}/admin/inventory/items/${itemId}`);
      if (productId) await assertPageOk(page, `${ADMIN}/${locale}/admin/reports/products/${productId}`);
      await assertPageOk(page, `${ADMIN}/${locale}/admin/requests`);
      await page.screenshot({
        path: `e2e/screenshots/web-parity-admin-${locale}.png`,
        fullPage: true,
      });
    }
  });

  test('dealer nile catalog basket money (ar + tablet)', async ({ page }) => {
    test.setTimeout(8 * 60_000);
    const token = await apiLogin('nile');
    const catalog = await apiGet<{ data: Array<{ id: string }> }>(
      '/api/v1/catalog/browse/products?pageSize=1',
      token,
    );
    const productId = catalog.data?.[0]?.id;
    expect(productId).toBeTruthy();

    await page.setViewportSize({ width: 768, height: 1024 });
    await loginPortal(page, CUSTOMER, 'ar', 'nile');
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/catalog`);
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/catalog/${productId}`);
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/catalog/${productId}/customize`);
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/order/custom`);
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/basket`);
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/payments`);
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/statement`);
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/invoices`);
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/returns`);
    await assertPageOk(page, `${CUSTOMER}/ar/dealer/profile`);
    await page.screenshot({
      path: 'e2e/screenshots/web-parity-dealer-ar-tablet.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await loginPortal(page, CUSTOMER, 'en', 'nile');
    await assertPageOk(page, `${CUSTOMER}/en/dealer/catalog`);
    await loginPortal(page, CUSTOMER, 'he', 'nile');
    await assertPageOk(page, `${CUSTOMER}/he/dealer/payments`);
  });

  test('worker carpenter + driver floor routes', async ({ page }) => {
    test.setTimeout(8 * 60_000);
    const carpenter = await apiLogin('carpenter');
    const mine = await apiGet<{
      data?: Array<{ salesOrderId: string; items: Array<{ id: string }> }>;
      orders?: Array<{ salesOrderId: string; items: Array<{ id: string }> }>;
    }>('/api/v1/tasks/my-orders?segment=open', carpenter);
    const groups = mine.data ?? mine.orders ?? [];
    const soId = groups[0]?.salesOrderId;
    const poId = groups[0]?.items?.[0]?.id;
    const tasks = await apiGet<{ data: Array<{ id: string }> }>('/api/v1/tasks?mine=true&pageSize=1', carpenter);
    const taskId = tasks.data?.[0]?.id;

    await loginPortal(page, EMPLOYEE, 'ar', 'carpenter');
    await assertPageOk(page, `${EMPLOYEE}/ar/worker/tasks`);
    if (soId) await assertPageOk(page, `${EMPLOYEE}/ar/worker/orders/${soId}`);
    if (poId) await assertPageOk(page, `${EMPLOYEE}/ar/worker/lane/${poId}`);
    if (taskId) {
      await assertPageOk(page, `${EMPLOYEE}/ar/worker/tasks/${taskId}`);
      await assertPageOk(page, `${EMPLOYEE}/ar/worker/tasks/${taskId}/take-in`);
    }
    await page.screenshot({
      path: 'e2e/screenshots/web-parity-worker-ar.png',
      fullPage: true,
    });

    const driver = await apiLogin('driver');
    const deliveries = await apiGet<{ data: Array<{ id: string }> }>(
      '/api/v1/deliveries?mine=true&pageSize=1',
      driver,
    );
    const deliveryId = deliveries.data?.[0]?.id;
    await loginPortal(page, EMPLOYEE, 'en', 'driver');
    await assertPageOk(page, `${EMPLOYEE}/en/worker/tasks`);
    if (deliveryId) await assertPageOk(page, `${EMPLOYEE}/en/worker/deliveries/${deliveryId}`);
  });
});
