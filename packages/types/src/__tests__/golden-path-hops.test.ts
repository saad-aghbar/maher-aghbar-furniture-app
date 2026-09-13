import {
  buildOrderLineSpecSnapshot,
  classifyManufacturingComplexity,
} from '../manufacturing-complexity';
import { lineVisualFromOrderSpec, lineVisualIdentity } from '../line-visual-identity';
import { isFactoryWorkStarted } from '../workflow-assign-lock';
import type { ProductionTaskStatus } from '../index';

describe('golden-path hops', () => {
  it('keeps a named catalog variant STANDARD', () => {
    expect(
      classifyManufacturingComplexity({
        productId: 'p-karina',
        variantId: 'v-karina',
        width: 250,
        catalog: { width: 250, height: 85, depth: 95, seatHeight: 45 },
      }),
    ).toBe('STANDARD');
  });

  it('classifies custom with no productId and never invents a product', () => {
    const snap = buildOrderLineSpecSnapshot({
      productName: 'Reception sofa',
      quantity: 1,
      notes: 'Bespoke arms',
      primaryImageDocumentId: 'doc-photo-1',
      productImageRef: 'https://example.com/custom.jpg',
    });
    expect(snap.productId).toBeNull();
    expect(snap.manufacturingComplexity).toBe('CUSTOM');
    expect(snap.primaryImageDocumentId).toBe('doc-photo-1');
    expect(snap.productImageRef).toBe('https://example.com/custom.jpg');
  });

  it('freezes catalog dims, variant code, and model sku onto orderSpec', () => {
    const catalog = { width: 220, height: 85, depth: 95, seatHeight: 45, sku: 'SOF-3S-STD' };
    const snap = buildOrderLineSpecSnapshot({
      productId: 'p1',
      variantId: 'v-karina',
      variantSku: 'SOF-KARINA',
      variantLabel: 'Karina',
      variantCode: 'KARINA',
      modelSku: 'SOF-3S-STD',
      productName: '3-Seater',
      quantity: 2,
      catalog,
      width: 220,
      height: 85,
      depth: 95,
      seatHeight: 45,
    });
    expect(snap.variantCode).toBe('KARINA');
    expect(snap.modelSku).toBe('SOF-3S-STD');
    expect(snap.catalogDimensions).toEqual({
      width: 220,
      height: 85,
      depth: 95,
      seatHeight: 45,
    });
    catalog.width = 999;
    expect(snap.catalogDimensions?.width).toBe(220);
  });

  it('uses custom photo first, then snapshot ref, then live catalog', () => {
    expect(
      lineVisualIdentity({
        primaryImageDocumentId: 'doc-1',
        productImageRef: 'https://snap',
        productImageUrl: 'https://live',
        resolveDocumentUrl: (id) => (id === 'doc-1' ? 'https://doc' : null),
      }),
    ).toBe('https://doc');
    expect(
      lineVisualIdentity({
        productImageRef: 'https://snap',
        productImageUrl: 'https://live',
      }),
    ).toBe('https://snap');
    expect(
      lineVisualFromOrderSpec(
        { productImageRef: 'https://frozen-custom' },
        { productImageUrl: 'https://live-catalog' },
      ),
    ).toBe('https://frozen-custom');
  });

  it('locks workflow assign after factory release', () => {
    expect(isFactoryWorkStarted({ releasedToFactoryAt: '2026-09-01' })).toBe(true);
    expect(isFactoryWorkStarted({ status: 'IN_PROGRESS' })).toBe(true);
    expect(isFactoryWorkStarted({ status: 'PLANNED', releasedToFactoryAt: null })).toBe(false);
  });

  it('aliases ProductionTaskStatus to the Prisma task set', () => {
    const statuses: ProductionTaskStatus[] = [
      'NOT_STARTED',
      'READY',
      'IN_PROGRESS',
      'PAUSED',
      'BLOCKED',
      'READY_FOR_INSPECTION',
      'COMPLETED',
      'CANCELLED',
    ];
    expect(statuses).toHaveLength(8);
    expect(statuses.includes('PENDING' as ProductionTaskStatus)).toBe(false);
    expect(statuses.includes('ON_HOLD' as ProductionTaskStatus)).toBe(false);
  });
});
