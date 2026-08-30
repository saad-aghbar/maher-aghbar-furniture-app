import {
  clampWizardStep,
  migrateDraftStep,
  pickPersistedFields,
} from '../newOrderSteps';
import { normalizeLocalDraft } from '../newOrderDraftNormalize';

describe('newOrderSteps', () => {
  it('clamps wizard to 4 steps', () => {
    expect(clampWizardStep(0)).toBe(1);
    expect(clampWizardStep(1)).toBe(1);
    expect(clampWizardStep(4)).toBe(4);
    expect(clampWizardStep(9)).toBe(4);
  });

  it('migrates legacy 6-step drafts onto 4 steps', () => {
    expect(migrateDraftStep(1, 1)).toBe(1);
    expect(migrateDraftStep(2, 1)).toBe(2);
    expect(migrateDraftStep(3, 1)).toBe(3);
    expect(migrateDraftStep(4, 1)).toBe(2);
    expect(migrateDraftStep(5, 1)).toBe(4);
    expect(migrateDraftStep(6, 1)).toBe(4);
  });

  it('keeps v2 steps within 1–4', () => {
    expect(migrateDraftStep(3, 2)).toBe(3);
    expect(migrateDraftStep(6, 2)).toBe(4);
  });

  it('persists business fields across step navigation snapshots', () => {
    const fields = pickPersistedFields({
      productId: 'p1',
      customProductName: 'Sofa',
      quantity: '3',
      externalOrderNumber: 'PO-9',
      priority: 'HIGH',
      fabric: 'Linen',
      fabricDescription: 'Beige',
      dimensionsNotes: 'W200',
      orderNotes: 'Rush',
      deliveryAddress: '12 Main',
      endCustomerName: 'Omar',
      endCustomerPhone: '+970591234567',
      deliveryNotes: 'Gate 2',
      deliveryLat: 31.9,
      deliveryLng: 35.2,
    });
    expect(fields.customProductName).toBe('Sofa');
    expect(fields.quantity).toBe('3');
    expect(fields.externalOrderNumber).toBe('PO-9');
    expect(fields.fabric).toBe('Linen');
    expect(fields.deliveryAddress).toBe('12 Main');
    expect(fields.endCustomerPhone).toBe('+970591234567');
    expect(fields.deliveryLat).toBe(31.9);
  });
});

describe('normalizeLocalDraft', () => {
  it('restores a v1 draft and remaps fabric step onto order details', () => {
    const restored = normalizeLocalDraft({
      version: 1,
      step: 4,
      productId: 'abc',
      customProductName: 'Chair',
      quantity: '2',
      externalOrderNumber: 'PO-1',
      priority: 'NORMAL',
      fabric: 'Velvet',
      fabricDescription: 'Blue',
      dimensionsNotes: '',
      orderNotes: 'note',
      deliveryAddress: 'Ramallah',
      endCustomerName: 'Sara',
      endCustomerPhone: '',
      deliveryNotes: '',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(restored).not.toBeNull();
    expect(restored!.version).toBe(3);
    expect(restored!.step).toBe(2);
    expect(restored!.customProductName).toBe('Chair');
    expect(restored!.fabric).toBe('Velvet');
    expect(restored!.deliveryAddress).toBe('Ramallah');
  });

  it('restores a v2 draft on attachments step', () => {
    const restored = normalizeLocalDraft({
      version: 2,
      step: 4,
      productId: '',
      customProductName: 'Table',
      quantity: '1',
      externalOrderNumber: '',
      priority: 'LOW',
      fabric: '',
      fabricDescription: '',
      dimensionsNotes: '',
      orderNotes: '',
      deliveryAddress: 'Nablus',
      endCustomerName: '',
      endCustomerPhone: '',
      deliveryNotes: '',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(restored?.step).toBe(4);
    expect(restored?.customProductName).toBe('Table');
    expect(restored?.version).toBe(3);
    expect(restored?.dimWidth).toBe('');
  });

  it('migrates freeform dimensions notes into structured fields', () => {
    const restored = normalizeLocalDraft({
      version: 2,
      step: 2,
      productId: '',
      customProductName: 'Sofa',
      quantity: '1',
      externalOrderNumber: '',
      priority: 'NORMAL',
      fabric: '',
      fabricDescription: '',
      dimensionsNotes: 'W 160 × H 85 × D 95 × Seat 45 cm',
      orderNotes: '',
      deliveryAddress: '',
      endCustomerName: '',
      endCustomerPhone: '',
      deliveryNotes: '',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(restored?.dimWidth).toBe('160');
    expect(restored?.dimHeight).toBe('85');
    expect(restored?.dimDepth).toBe('95');
    expect(restored?.dimSeat).toBe('45');
  });

  it('rejects unknown draft versions', () => {
    expect(normalizeLocalDraft({ version: 99 as 1, step: 1 })).toBeNull();
  });

  it('coerces string delivery coordinates from persisted drafts', () => {
    const restored = normalizeLocalDraft({
      version: 3,
      step: 3,
      productId: '',
      customProductName: '',
      quantity: '1',
      externalOrderNumber: '',
      priority: 'NORMAL',
      fabric: '',
      fabricDescription: '',
      dimensionsNotes: '',
      orderNotes: '',
      deliveryAddress: 'Ramallah',
      endCustomerName: '',
      endCustomerPhone: '',
      deliveryNotes: '',
      deliveryLat: '31.95220',
      deliveryLng: '35.23320',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    expect(restored?.deliveryLat).toBeCloseTo(31.9522);
    expect(restored?.deliveryLng).toBeCloseTo(35.2332);
    expect(typeof restored?.deliveryLat).toBe('number');
  });
});
