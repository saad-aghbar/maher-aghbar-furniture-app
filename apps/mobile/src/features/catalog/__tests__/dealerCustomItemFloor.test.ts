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

describe('Dealer custom item floor', () => {
  const files = [
    'DealerCustomItemScreen.tsx',
    'components/DealerCustomPhotosBoard.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(
        /MoreBoard|orderBoardShadow|AnimatedPressable|BottomSheet|CatalogSectionBoard/,
      );
    }
  });

  it('does not create catalog library specs or set a dealer price', () => {
    const screen = read('DealerCustomItemScreen.tsx');
    const photos = read('components/DealerCustomPhotosBoard.tsx');
    expect(screen).toContain('DealerCustomPhotosBoard');
    expect(screen).toContain('DealerOrderSpecsBoard');
    expect(screen).toContain('DealerMeasurementsBoard');
    expect(screen).toContain("productId: ''");
    expect(screen).toContain("dealerPrice: ''");
    expect(screen).toContain('waitingForFactoryPrice');
    expect(screen).not.toContain('createSpecOptionGroup');
    expect(screen).not.toContain('createSpecOptionValue');
    expect(photos).toContain('trash-outline');
    expect(photos).toContain('ProductPhotoSourceSheet');
  });
});
