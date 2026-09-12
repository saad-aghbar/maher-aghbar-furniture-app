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

describe('Order items-first flow floor', () => {
  const files = ['OrderProductionFlowScreen.tsx', 'components/OrderFlowItemCard.tsx'];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(/orderBoardShadow|AnimatedPressable|DealerEmptyPanel|ListItemEnter/);
    }
  });

  it('lists items then opens a production-order flow map', () => {
    const host = read('OrderProductionFlowScreen.tsx');
    expect(host).toContain('source="production-order"');
    expect(host).toContain('shouldSkipOrderFlowList');
    expect(host).toContain('OrderFlowItemCard');
  });
});
