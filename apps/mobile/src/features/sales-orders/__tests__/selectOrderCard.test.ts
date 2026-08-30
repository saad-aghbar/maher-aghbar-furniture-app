import {
  assertDealerCardSafe,
  toAdminOrderCard,
  toDealerOrderCard,
} from '../selectOrderCard';
import { adminOrdersFixture, dealerOrdersFixture } from '../fixtures';

describe('selectOrderCard', () => {
  it('maps admin card with cost and profit', () => {
    expect(adminOrdersFixture.length).toBeGreaterThanOrEqual(80);
    const card = toAdminOrderCard(adminOrdersFixture[0]!);
    expect(card.number).toMatch(/^SO-VOL-/);
    expect(card.dealerName.length).toBeGreaterThan(0);
    expect(card.manufacturingCost).toEqual(expect.any(Number));
    expect(card.profit).toEqual(expect.any(Number));
    expect(card.sellerPrice).toEqual(expect.any(Number));
    expect(card.progressPercent == null || card.progressPercent >= 0).toBe(true);
  });

  it('prefers localized dealer name when available', () => {
    const item = {
      ...adminOrdersFixture[0]!,
      customer: {
        id: 'c-loc',
        name: 'النيل للديكور',
        nameEn: 'Nile Interiors',
        nameAr: 'النيل للديكور',
        nameHe: 'נילוס לדיקור',
        code: 'CUS-0101',
      },
    };
    expect(toAdminOrderCard(item, 'ar').dealerName).toBe('النيل للديكور');
    expect(toAdminOrderCard(item, 'he').dealerName).toBe('נילוס לדיקור');
    expect(toAdminOrderCard(item, 'en').dealerName).toBe('Nile Interiors');
  });

  it('maps admin floor stage into progressLabel', () => {
    const card = toAdminOrderCard(
      {
        ...adminOrdersFixture[0]!,
        currentStage: {
          code: 'PAINTING',
          nameEn: 'Painting',
          nameAr: 'دهان',
          nameHe: 'צביעה',
        },
      },
      'en',
    );
    expect(card.progressLabel).toBe('Painting');
  });

  it('maps dealer card without cost or profit keys', () => {
    expect(dealerOrdersFixture.length).toBeGreaterThanOrEqual(20);
    const card = toDealerOrderCard(dealerOrdersFixture[0]!);
    expect(card.number).toMatch(/^SO-VOL-/);
    expect(card.progressLabel).toEqual(expect.any(String));
    expect(card.sellerPrice).toEqual(expect.any(Number));
    assertDealerCardSafe(card);
    expect(JSON.stringify(card)).not.toContain('manufacturingCost');
    expect(JSON.stringify(card)).not.toContain('profit');
  });

  it('covers stage variety for composition QA', () => {
    const statuses = new Set(adminOrdersFixture.map((o) => o.status));
    expect(statuses.has('IN_PRODUCTION')).toBe(true);
    expect(statuses.has('READY_FOR_DELIVERY')).toBe(true);
    expect(statuses.has('CONFIRMED')).toBe(true);
    expect(statuses.has('DELIVERED') || statuses.has('COMPLETED')).toBe(true);
    const progresses = adminOrdersFixture.map((o) => o.progressPercent ?? 0);
    expect(Math.min(...progresses)).toBeLessThan(20);
    expect(Math.max(...progresses)).toBe(100);
  });
});
