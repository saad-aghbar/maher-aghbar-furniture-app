import { classifyMaterialDemand } from './material-demand';

describe('classifyMaterialDemand', () => {
  const requiredBy = new Date('2026-08-16T05:00:00.000Z');
  const eta = new Date('2026-08-18T05:00:00.000Z');

  it('COVERED when free meets required', () => {
    expect(
      classifyMaterialDemand({
        requiredQty: 8,
        freeQty: 10,
        incoming: [],
        nextRequiredBy: requiredBy,
      }),
    ).toBe('COVERED');
  });

  it('AT_RISK when incoming covers after required-by', () => {
    expect(
      classifyMaterialDemand({
        requiredQty: 8,
        freeQty: 0,
        incoming: [{ qty: 24, readyAt: eta }],
        nextRequiredBy: requiredBy,
      }),
    ).toBe('AT_RISK');
  });

  it('COVERED when incoming arrives on time', () => {
    expect(
      classifyMaterialDemand({
        requiredQty: 8,
        freeQty: 0,
        incoming: [{ qty: 24, readyAt: requiredBy }],
        nextRequiredBy: requiredBy,
      }),
    ).toBe('COVERED');
  });

  it('SHORTAGE when dated incoming is not enough', () => {
    expect(
      classifyMaterialDemand({
        requiredQty: 8,
        freeQty: 0,
        incoming: [{ qty: 2, readyAt: eta }],
        nextRequiredBy: requiredBy,
      }),
    ).toBe('SHORTAGE');
  });

  it('NO_ETA when deficit has no dated incoming', () => {
    expect(
      classifyMaterialDemand({
        requiredQty: 8,
        freeQty: 0,
        incoming: [],
        nextRequiredBy: requiredBy,
      }),
    ).toBe('NO_ETA');
  });
});
