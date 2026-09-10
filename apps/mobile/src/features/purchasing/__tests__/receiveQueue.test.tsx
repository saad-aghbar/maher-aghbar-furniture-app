import { readFileSync } from 'fs';
import { join } from 'path';

const chrome = readFileSync(
  join(__dirname, '../../inventory/components/InventoryCompositionChrome.tsx'),
  'utf8',
);
const home = readFileSync(
  join(__dirname, '../../inventory/components/InventorySignatureHome.tsx'),
  'utf8',
);
const queue = readFileSync(join(__dirname, '../ReceiveQueueScreen.tsx'), 'utf8');

describe('receive queue entry', () => {
  it('gates the inventory button on receive permission', () => {
    expect(chrome).toContain('canReceiveOrders');
    expect(chrome).toContain('cube-outline');
    expect(home).toContain('inventory.receive');
    expect(home).toContain('/inventory/receive');
    expect(queue).toContain('DealerEmptyPanel');
    expect(queue).toContain('receivableEmptyBody');
  });
});
