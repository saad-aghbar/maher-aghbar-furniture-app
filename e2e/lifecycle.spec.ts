import { test, expect } from '@playwright/test';

const API = process.env.API_URL ?? 'http://localhost:4000';
const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';

test.describe('Maher ERP lifecycle smoke', () => {
  test('admin login page loads', async ({ page }) => {
    const res = await page.goto(`${ADMIN}/en/login`);
    expect(res?.ok()).toBeTruthy();
    await expect(page.getByRole('button')).toBeVisible();
  });

  test('API health + auth + reports', async ({ request }) => {
    const health = await request.get(`${API}/api/v1/health`);
    expect(health.ok()).toBeTruthy();

    const login = await request.post(`${API}/api/v1/auth/login`, {
      data: { emailOrPhone: 'admin@maher-aghbar.jo', password: 'Admin@12345!' },
    });
    expect(login.ok()).toBeTruthy();

    const reports = await request.get(`${API}/api/v1/reports/dashboard`);
    expect(reports.ok()).toBeTruthy();
    const body = await reports.json();
    expect(body).toHaveProperty('activeOrders');

    const templates = await request.get(`${API}/api/v1/notifications/templates`);
    expect(templates.ok()).toBeTruthy();
  });
});
