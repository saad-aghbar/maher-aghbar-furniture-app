import { readFileSync } from 'fs';
import { join } from 'path';

const dock = readFileSync(
  join(__dirname, '../components/InventoryReceiveDock.tsx'),
  'utf8',
);

describe('inventory receive dock', () => {
  it('is a parchment board of matching wood pills, not a nested cream sausage', () => {
    expect(dock).toContain('borderRadius: theme.radius.xl');
    expect(dock).toContain('orderBoardShadow');
    expect(dock).toContain('theme.radius.full');
    expect(dock).toContain('onCreatePo');
    expect(dock).toContain('onReceive');
    expect(dock).toContain('download-outline');
    expect(dock).not.toContain('borderRadius: 28');
    expect(dock).not.toContain('borderRadius: 22');
    expect(dock).not.toContain('borderRadius: 14');
    expect(dock).not.toContain('rgba(245,241,234,0.18)');
  });
});
