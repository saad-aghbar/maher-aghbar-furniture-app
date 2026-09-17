import { SURFACE_TAB_BAR_CLEARANCE, surfaceClearanceFor, tabBarReserve } from '@/navigation/tabBarClearance';

describe('surfaceClearanceFor', () => {
  it('COMPACT keeps the phone 88 + safe-area inset', () => {
    expect(surfaceClearanceFor('compact', 34)).toBe(SURFACE_TAB_BAR_CLEARANCE + 34);
    expect(surfaceClearanceFor('compact', 0)).toBe(SURFACE_TAB_BAR_CLEARANCE);
    expect(tabBarReserve('compact')).toBe(SURFACE_TAB_BAR_CLEARANCE);
  });

  it('MEDIUM and above drop the pill reserve', () => {
    expect(surfaceClearanceFor('medium', 34)).toBe(34);
    expect(surfaceClearanceFor('expanded', 20)).toBe(20);
    expect(surfaceClearanceFor('wide', 0)).toBe(0);
    expect(tabBarReserve('wide')).toBe(0);
  });

  it('dealer and worker keep the pill reserve on every window class', () => {
    expect(tabBarReserve('wide', 'customer')).toBe(SURFACE_TAB_BAR_CLEARANCE);
    expect(tabBarReserve('expanded', 'employee')).toBe(SURFACE_TAB_BAR_CLEARANCE);
    expect(surfaceClearanceFor('wide', 34, 'customer')).toBe(SURFACE_TAB_BAR_CLEARANCE + 34);
  });
});
