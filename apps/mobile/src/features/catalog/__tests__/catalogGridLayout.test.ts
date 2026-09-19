import { catalogCardWidth, catalogGridColumns } from '../catalogGridLayout';

const PAD = 16;
const GAP = 12;

describe('catalogGridLayout', () => {
  it('keeps the phone store at two equal tiles', () => {
    expect(catalogGridColumns(390, PAD, GAP)).toBe(2);
    expect(catalogCardWidth(390, 2, PAD, GAP)).toBe((390 - 32 - 12) / 2);
  });

  it('stays two-up in an iPad split primary pane', () => {
    expect(catalogGridColumns(500, PAD, GAP)).toBe(2);
    expect(catalogGridColumns(466, PAD, GAP)).toBe(2);
  });

  it('adds columns only when the pane is actually wide enough', () => {
    expect(catalogGridColumns(744, PAD, GAP)).toBe(3);
    expect(catalogGridColumns(1100, PAD, GAP)).toBe(4);
  });

  it('does not use window-class capacity when the pane is narrow', () => {
    // Full iPad is 4-wide; the products split column is not.
    expect(catalogGridColumns(1366, PAD, GAP)).toBe(4);
    expect(catalogGridColumns(420, PAD, GAP)).toBe(2);
  });
});
