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
    'WorkerCompletedSalesOrderItemsScreen.tsx',
    'components/WorkerSalesOrderCard.tsx',
    'components/WorkerSalesOrderItemRow.tsx',
    'components/WorkerSalesOrderIdentityBoard.tsx',
    'components/WorkerCompletedSalesOrderCard.tsx',
    'components/WorkerCompletedTaskRow.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      assertFloor(read(file));
    }
  });

  it('opens items then the existing lane, including a single-item order', () => {
    const card = read('components/WorkerSalesOrderCard.tsx');
    const href = read('selectWorkerOrder.ts');
    const list = read('TasksListScreen.tsx');
    const items = read('WorkerSalesOrderItemsScreen.tsx');
    expect(list).toContain('WorkerSalesOrderCard');
    expect(card).toContain('workerSalesOrderHref');
    expect(card).toContain('WorkerSalesOrderItemRow');
    expect(card).toContain('order.items');
    expect(href).toContain('/(app)/(employee)/orders/');
    expect(href).not.toContain('itemCount <= 1');
    expect(items).toContain('WorkerOrderCard');
    expect(items).toContain('WorkerSalesOrderIdentityBoard');
  });

  it('nested item rows open the same sales-order items picker', () => {
    const card = read('components/WorkerSalesOrderCard.tsx');
    expect(card).toContain('onPress={goToPicker}');
    expect(card).toContain('workerSalesOrderHref');
    expect(card).not.toContain('/(app)/(employee)/lane/');
  });

  it('completed tab uses order boards with nested tasks and a photo identity picker', () => {
    const list = read('TasksListScreen.tsx');
    const card = read('components/WorkerCompletedSalesOrderCard.tsx');
    const items = read('WorkerCompletedSalesOrderItemsScreen.tsx');
    const select = read('selectTask.ts');
    expect(list).toContain('WorkerCompletedSalesOrderCard');
    expect(card).toContain('WorkerCompletedTaskRow');
    expect(card).toContain('workerCompletedSalesOrderHref');
    expect(select).toContain('/(app)/(employee)/completed-orders/');
    expect(items).toContain('WorkerSalesOrderIdentityBoard');
    expect(items).toContain('completed');
    expect(items).toContain('TaskCard');
  });
});
