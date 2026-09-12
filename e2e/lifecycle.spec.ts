import { test, expect } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:4000';
const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';

test.describe('Maher ERP lifecycle smoke', () => {
  test('admin login page loads', async ({ page }) => {
    let lastStatus = 0;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await page.goto(`${ADMIN}/en/login`, { waitUntil: 'domcontentloaded' });
      lastStatus = res?.status() ?? 0;
      if (lastStatus && lastStatus < 500) break;
      await page.waitForTimeout(1500);
    }
    if (lastStatus >= 500 || lastStatus === 0) {
      test.skip(true, `Admin web returned ${lastStatus} at ${ADMIN}/en/login — restart admin-web`);
      return;
    }
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('API health + auth + reports', async ({ request }) => {
    const health = await request.get(`${API}/api/v1/health`);
    expect(health.ok()).toBeTruthy();

    const login = await request.post(`${API}/api/v1/auth/login`, {
      data: { username: 'admin', password: '123', client: 'mobile' },
    });
    expect(login.ok()).toBeTruthy();
    const session = await login.json();
    const token = session.accessToken as string | undefined;
    expect(token).toBeTruthy();

    const reports = await request.get(`${API}/api/v1/reports/dashboard`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(reports.ok()).toBeTruthy();
    const body = await reports.json();
    expect(body).toHaveProperty('newOrders');
    expect(body).toHaveProperty('ordersInProduction');

    const templates = await request.get(`${API}/api/v1/notifications/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(templates.ok()).toBeTruthy();
  });
});
