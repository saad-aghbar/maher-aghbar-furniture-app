import { readFileSync } from 'fs';
import { join } from 'path';

const dir = join(__dirname, '..');

function read(path: string) {
  return readFileSync(join(dir, path), 'utf8');
}

function assertFloor(source: string) {
  expect(source).not.toContain('DeskCard');
  expect(source).not.toContain('SurfaceCard');
  expect(source).not.toContain('colors.info');
  expect(source).not.toContain("fontWeight: '700'");
}

describe('Worker sales-order items floor', () => {
  const files = [
    'TasksListScreen.tsx',
    'WorkerSalesOrderItemsScreen.tsx',
    'components/WorkerSalesOrderCard.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      assertFloor(read(file));
    }
  });

  it('opens items then the existing lane, skipping a single-item order', () => {
    const card = read('components/WorkerSalesOrderCard.tsx');
    const list = read('TasksListScreen.tsx');
    const items = read('WorkerSalesOrderItemsScreen.tsx');
    expect(list).toContain('WorkerSalesOrderCard');
    expect(card).toContain('itemCount <= 1');
    expect(card).toContain('/(app)/(employee)/lane/');
    expect(card).toContain('/(app)/(employee)/orders/[salesOrderId]');
    expect(items).toContain('WorkerOrderCard');
  });
});
