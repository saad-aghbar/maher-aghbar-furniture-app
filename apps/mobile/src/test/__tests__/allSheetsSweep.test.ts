import {
  hasFooterAction,
  hasHeightConstraint,
  loadSheetContracts,
} from '../sheetContract';

describe('all-sheets sweep', () => {
  const rows = loadSheetContracts();

  it('enumerates every *Sheet.tsx under components and features', () => {
    expect(rows.length).toBeGreaterThan(80);
  });

  it('hosts use BottomSheet with a height constraint and a footer action', () => {
    const hosts = rows.filter((row) => row.kind === 'host');
    expect(hosts.length).toBeGreaterThan(40);
    const missingHeight: string[] = [];
    const missingFooter: string[] = [];
    for (const row of hosts) {
      if (!hasHeightConstraint(row.source)) missingHeight.push(row.rel);
      if (!hasFooterAction(row.source)) missingFooter.push(row.rel);
    }
    expect(missingHeight).toEqual([]);
    expect(missingFooter).toEqual([]);
  });

  it('overflowing hosts still sit inside BottomSheet (default 360 / fitContent / expandable)', () => {
    const hosts = rows.filter((row) => row.kind === 'host');
    const unbounded = hosts.filter((row) => !hasHeightConstraint(row.source));
    expect(unbounded).toEqual([]);
  });

  it('wrappers and bodies still expose a pressable action', () => {
    const others = rows.filter((row) => row.kind !== 'host');
    const missing = others.filter(
      (row) => !hasFooterAction(row.source) && !/onSelect|onPress|export \{/.test(row.source),
    );
    expect(missing).toEqual([]);
  });
});
