import { readFileSync } from 'fs';
import { join } from 'path';
import { isAtLeast, resolveWindowClass } from '@/adaptive/breakpoints';

describe('Inventory hub adaptive contracts', () => {
  it('splits only at expanded and wide', () => {
    expect(isAtLeast(resolveWindowClass(390), 'expanded')).toBe(false);
    expect(isAtLeast(resolveWindowClass(899), 'expanded')).toBe(false);
    expect(isAtLeast(resolveWindowClass(900), 'expanded')).toBe(true);
  });

  it('does not invent a parallel identify path — camera and typed dock share dispatchIdentifyCode', () => {
    const src = readFileSync(
      join(__dirname, '../components/InventorySignatureHome.tsx'),
      'utf8',
    );
    expect(src.match(/resolveInventoryScan/g)?.length).toBeGreaterThanOrEqual(1);
    expect(src).toContain('function dispatchIdentifyCode');
    expect(src).toContain('function runIdentifyScan');
    const cameraBlock = src.slice(
      src.indexOf('async function runIdentifyScan'),
      src.indexOf('function openInventoryItem'),
    );
    expect(cameraBlock).toContain('openScanner');
    expect(cameraBlock).toContain('dispatchIdentifyCode');
    expect(cameraBlock).not.toContain('resolveInventoryScan');
  });
});
