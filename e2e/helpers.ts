import { expect, type Locator, type Page } from '@playwright/test';

export const ADMIN = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://127.0.0.1:3000';
export const API = process.env.API_URL ?? 'http://127.0.0.1:4000';
export const LOCALES = ['en', 'ar', 'he'] as const;
export type Locale = (typeof LOCALES)[number];

export async function gotoAdminLogin(page: Page, locale: Locale = 'en') {
  const url = `${ADMIN}/${locale}/login`;
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  return { url, status: res?.status() ?? 0 };
}

export async function assertLoginVisible(page: Page) {
  await expect(page.getByRole('button', { name: /sign in|تسجيل الدخول|התחברות/i })).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Every table row in `root` must expose a link (identity column), so Cost &
 * Performance never ships dead text rows.
 */
export async function assertEveryTableRowHasLink(root: Locator) {
  const rows = root.locator('tbody tr');
  const count = await rows.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const row = rows.nth(i);
    const links = row.locator('a[href]');
    await expect(links.first(), `row ${i} must expose a link`).toBeVisible();
  }
}

export async function screenshotLocales(
  page: Page,
  pathFor: (locale: Locale) => string,
  goto: (locale: Locale) => Promise<void>,
) {
  for (const locale of LOCALES) {
    await goto(locale);
    await page.screenshot({ path: pathFor(locale), fullPage: true });
  }
}
