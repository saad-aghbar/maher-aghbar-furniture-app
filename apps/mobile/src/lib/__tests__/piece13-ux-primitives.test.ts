import { stickyCtaBottomInset } from '@/components/layout/stickyCtaInset';
import { presentStatus } from '@/lib/presentStatus';

describe('Piece 13 UX primitives', () => {
  it('stickyCtaBottomInset uses max(safe, spacing) + tab clearance', () => {
    expect(stickyCtaBottomInset(34, 12, 56)).toBe(34 + 56);
    expect(stickyCtaBottomInset(0, 8, 0)).toBe(8);
    expect(stickyCtaBottomInset(10, 20, 40)).toBe(20 + 40);
  });

  it('presentStatus never returns raw OUT_FOR_DELIVERY', () => {
    expect(presentStatus('OUT_FOR_DELIVERY')).toBe('Shipped');
    expect(presentStatus('READY_FOR_DELIVERY')).toBe('Ready');
    expect(presentStatus('READY_FOR_INSPECTION')).toBe('Waiting inspection');
  });

  it('presentStatus title-cases unknown enums', () => {
    expect(presentStatus('SOME_CUSTOM_STATUS')).toBe('Some Custom Status');
  });
});
