import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://localhost:3000';
const PORTAL = process.env.NEXT_PUBLIC_PORTAL_URL ?? 'http://localhost:3001';
const API = process.env.API_URL ?? 'http://localhost:4000';
const OUT_DIR = path.join(process.cwd(), 'tmp-lifecycle-screenshots');

async function resolveStandardWorkflowId(request: import('@playwright/test').APIRequestContext) {
  const login = await request.post(`${API}/api/v1/auth/mobile/login`, {
    data: { username: 'admin', password: '123' },
  });
  const { accessToken } = await login.json();
  const wfs = await request.get(`${API}/api/v1/production-workflows`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await wfs.json();
  const rows = body.data ?? body;
  const std = rows.find((w: { code?: string }) => w.code === 'STANDARD_FURNITURE') ?? rows[0];
  return { id: std.id as string, token: accessToken as string };
}

test.describe('Lifecycle closure screenshots', () => {
  test.beforeAll(() => {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  });

  test('capture admin + portal + RTL surfaces', async ({ page, context, request }) => {
    test.setTimeout(180_000);
    const { id: wfId, token } = await resolveStandardWorkflowId(request);

    // Ensure at least one OUT_FOR_DELIVERY for Shipped tab content
    const dels = await request.get(`${API}/api/v1/deliveries?pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const delBody = await dels.json();
    const ready =
      (delBody.data ?? []).find((d: { status: string }) => d.status === 'READY') ??
      (delBody.data ?? []).find((d: { status: string }) => d.status === 'PLANNED');
    if (ready) {
      if (ready.status === 'PLANNED') {
        await request.patch(`${API}/api/v1/deliveries/${ready.id}/status`, {
          headers: { Authorization: `Bearer ${token}` },
          data: { status: 'READY' },
        });
      }
      await request.patch(`${API}/api/v1/deliveries/${ready.id}/status`, {
        headers: { Authorization: `Bearer ${token}` },
        data: { status: 'OUT_FOR_DELIVERY' },
      });
    }

    const login = await context.request.post(`${API}/api/v1/auth/login`, {
      data: { username: 'admin', password: '123' },
    });
    expect(login.ok()).toBeTruthy();

    await page.goto(`${ADMIN}/en/production/workflow/${wfId}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByText(/Inspection|inspection|Packaging|packaging/i).first()).toBeVisible({
      timeout: 60_000,
    });
    await page.screenshot({
      path: path.join(OUT_DIR, '01-workflow-terminal-block.png'),
      fullPage: true,
    });

    // Create draft so Add Stage is available
    const createDraft = page.getByRole('button', { name: /create draft/i });
    if (await createDraft.isVisible().catch(() => false)) {
      await createDraft.click();
      await page.waitForTimeout(2500);
    }

    const addStage = page.getByRole('button', { name: /add stage/i });
    if (await addStage.isVisible().catch(() => false)) {
      await addStage.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(OUT_DIR, '02-add-stage-no-terminal-pickers.png'),
        fullPage: true,
      });
      await page.keyboard.press('Escape');
    } else {
      // Still capture page state for evidence
      await page.screenshot({
        path: path.join(OUT_DIR, '02-add-stage-no-terminal-pickers.png'),
        fullPage: true,
      });
    }

    await page.goto(`${ADMIN}/en/inventory`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    const finished = page.getByRole('button', { name: /finished/i }).first();
    if (await finished.isVisible().catch(() => false)) await finished.click();
    await page.waitForTimeout(2500);
    await page.screenshot({
      path: path.join(OUT_DIR, '07-finished-goods-waiting-for-truck.png'),
      fullPage: true,
    });

    await page.goto(`${ADMIN}/en/deliveries`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /deliver/i }).first()).toBeVisible({
      timeout: 45_000,
    });
    await page.getByRole('button', { name: /^shipped$/i }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUT_DIR, '08-admin-shipped-awaiting-dealer.png'),
      fullPage: true,
    });

    await page.goto(`${ADMIN}/ar/production/workflow/${wfId}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('body')).toBeVisible({ timeout: 60_000 });
    await page.screenshot({
      path: path.join(OUT_DIR, '10-rtl-ar-workflow-terminal.png'),
      fullPage: true,
    });

    await context.clearCookies();
    const portalLogin = await context.request.post(`${API}/api/v1/auth/login`, {
      data: { username: 'balqis', password: '123' },
    });
    expect(portalLogin.ok()).toBeTruthy();

    await page.goto(`${PORTAL}/en/orders`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /shipped/i }).first()).toBeVisible({
      timeout: 45_000,
    });
    await page.getByRole('button', { name: /shipped/i }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUT_DIR, '04-dealer-orders-shipped-tab.png'),
      fullPage: true,
    });

    // Open first shipped/ready order if present for confirm UI
    const details = page.getByRole('link', { name: /details/i }).first();
    if (await details.isVisible().catch(() => false)) {
      await details.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(OUT_DIR, '05-shipped-detail-confirm.png'),
        fullPage: true,
      });
      await page.goto(`${PORTAL}/en/orders`, { waitUntil: 'domcontentloaded' });
    }

    await page.getByRole('button', { name: /delivered/i }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUT_DIR, '06-delivered-history.png'),
      fullPage: true,
    });

    await page.goto(`${PORTAL}/he/orders`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUT_DIR, '11-rtl-he-portal-orders.png'),
      fullPage: true,
    });

    const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.png'));
    console.log('screenshots', files.join(', '));
    expect(files).toEqual(expect.arrayContaining([
      '01-workflow-terminal-block.png',
      '02-add-stage-no-terminal-pickers.png',
      '07-finished-goods-waiting-for-truck.png',
      '08-admin-shipped-awaiting-dealer.png',
    ]));
  });
});
