import { isAtLeast, resolveWindowClass } from '@/adaptive/breakpoints';
import { consumeOrdersDeskChip, seedOrdersDeskChip } from '../ordersDeskContext';

describe('Orders desk split composition', () => {
  it('splits only at expanded and wide', () => {
    expect(isAtLeast(resolveWindowClass(390), 'expanded')).toBe(false);
    expect(isAtLeast(resolveWindowClass(820), 'expanded')).toBe(false);
    expect(isAtLeast(resolveWindowClass(1024), 'expanded')).toBe(true);
    expect(isAtLeast(resolveWindowClass(1440), 'expanded')).toBe(true);
  });

  it('re-consumes a seeded desk chip (wide selected change)', () => {
    seedOrdersDeskChip('preparing');
    expect(consumeOrdersDeskChip()).toBe('preparing');
    expect(consumeOrdersDeskChip()).toBeNull();
    seedOrdersDeskChip('ready_to_ship');
    expect(consumeOrdersDeskChip()).toBe('ready_to_ship');
  });
});
