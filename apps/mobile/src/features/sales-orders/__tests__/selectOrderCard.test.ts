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

  it('maps canonical manufacturingComplexity onto the card kind label', () => {
    const standard = toAdminOrderCard({
      ...adminOrdersFixture[0]!,
      manufacturingComplexity: 'STANDARD',
    });
    const mixed = toAdminOrderCard({
      ...adminOrdersFixture[0]!,
      manufacturingComplexity: 'MODIFIED',
    });
    const custom = toAdminOrderCard({
      ...adminOrdersFixture[0]!,
      manufacturingComplexity: 'CUSTOM',
    });
    expect(standard.manufacturingKind).toBe('standard');
    expect(mixed.manufacturingKind).toBe('modified');
    expect(custom.manufacturingKind).toBe('custom');
  });

  it('maps basket item rows from lineStrip, not a rollup chip strip', () => {
    const card = toAdminOrderCard(
      {
        ...adminOrdersFixture[0]!,
        lineCount: 3,
        manufacturingComplexity: 'CUSTOM',
        lineStrip: [
          {
            id: 'a',
            nameEn: 'Dining table',
            nameAr: 'طاولة سفرة',
            sku: 'TABLE-DIN-6',
            quantity: 1,
            manufacturingComplexity: 'STANDARD',
            imageUrl: 'https://example.com/a.jpg',
          },
          {
            id: 'b',
            nameEn: 'Side table',
            nameAr: 'طاولة جانبية',
            sku: 'TABLE-SIDE',
            quantity: 1,
            manufacturingComplexity: 'MODIFIED',
            imageUrl: 'https://example.com/b.jpg',
          },
          {
            id: 'c',
            nameEn: 'Custom sofa',
            sku: 'SOF-C',
            quantity: 1,
            manufacturingComplexity: 'CUSTOM',
            imageUrl: null,
          },
        ],
        productionOrders: [],
      },
      'en',
    );
    expect(card.items).toHaveLength(3);
    expect(card.items?.map((row) => row.complexity)).toEqual([
      'standard',
      'modified',
      'custom',
    ]);
    expect(card.items?.[0]?.title).toBe('Dining table');
    expect(card.items?.[0]?.fact).toBe('TABLE-DIN-6  × 1');
    expect(card.items?.[1]?.fact).toBe('TABLE-SIDE  × 1');
    expect(card.manufacturingKind).toBe('custom');
    expect(JSON.stringify(card)).not.toContain('planReadyOf');
  });

  it('joins in-production lines to their PO for percent facts', () => {
    const card = toAdminOrderCard(
      {
        ...adminOrdersFixture[0]!,
        lineStrip: [
          {
            id: 'sol-1',
            nameEn: 'Sofa',
            sku: 'SOF-3S',
            quantity: 1,
            manufacturingComplexity: 'STANDARD',
            imageUrl: null,
          },
        ],
        productionOrders: [
          {
            id: 'po-1',
            number: 'PO-1',
            status: 'IN_PROGRESS',
            salesOrderLineId: 'sol-1',
            progressPercent: 40,
          },
        ],
      },
      'en',
    );
    expect(card.items?.[0]?.fact).toBe('40%');
    expect(card.items?.[0]?.productionOrderId).toBe('po-1');
    expect(card.items?.[0]?.done).toBe(false);
  });

  it('maps hasReturn onto the admin card', () => {
    const withReturn = toAdminOrderCard({
      ...adminOrdersFixture[0]!,
      hasReturn: true,
    });
    const without = toAdminOrderCard({
      ...adminOrdersFixture[0]!,
      hasReturn: false,
    });
    expect(withReturn.hasReturn).toBe(true);
    expect(without.hasReturn).toBe(false);
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
