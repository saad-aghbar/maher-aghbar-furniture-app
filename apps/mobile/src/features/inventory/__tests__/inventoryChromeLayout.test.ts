import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(
  join(__dirname, '../components/InventoryCompositionChrome.tsx'),
  'utf8',
);

describe('inventory composition chrome layout', () => {
  it('title block has no action cluster', () => {
    const titleBlock = src.slice(
      src.indexOf('{t(\'mobile.inventory.pulseEyebrow\')}'),
      src.indexOf('<InventoryLifecycleTabs'),
    );
    expect(titleBlock).not.toContain('FloorActionButton');
    expect(titleBlock).not.toContain('onScan');
    expect(titleBlock).not.toContain('maxWidth');
  });

  it('scan sits on the search row as an icon well', () => {
    const searchBlock = src.slice(src.indexOf('showSearch && setSearchInput'), src.indexOf('createVisible || warehouseVisible'));
    expect(searchBlock).toContain('scanVisible');
    expect(searchBlock).toContain('qr-code-outline');
    expect(searchBlock).toContain('iconOnly');
    expect(searchBlock).toContain('sync-outline');
  });

  it('warehouse is gated like sync to materials + items', () => {
    expect(src).toContain("const onMaterialsItems = lifecycle === 'materials' && section === 'items'");
    expect(src).toContain('syncVisible = onMaterialsItems');
    expect(src).toContain('warehouseVisible =\n    onMaterialsItems');
  });
});
