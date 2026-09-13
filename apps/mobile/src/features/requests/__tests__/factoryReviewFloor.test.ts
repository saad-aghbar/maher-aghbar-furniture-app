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

describe('Factory review line desk floor', () => {
  const files = [
    'AdminRequestDetailScreen.tsx',
    'FactoryLineDeskScreen.tsx',
    'components/RfqLineTicket.tsx',
  ];

  it('keeps parchment boards and forbids SaaS cards', () => {
    for (const file of files) {
      const source = read(file);
      assertFloor(source);
      expect(source).toMatch(/DealerBoard|orderBoardShadow|CatalogSectionBoard|AnimatedPressable/);
    }
  });

  it('opens a line desk from tickets instead of SpecCorrectSheet', () => {
    const host = read('AdminRequestDetailScreen.tsx');
    expect(host).toContain('RfqLineTicket');
    expect(host).toContain('MonthCalendar');
    expect(host).not.toContain('SpecCorrectSheet');
    expect(host).not.toContain('YYYY-MM-DD');
    expect(read('FactoryLineDeskScreen.tsx')).toContain('verifyRequestSpec');
    expect(read('FactoryLineDeskScreen.tsx')).toContain('saveCorrections');
  });
});
