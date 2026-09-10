import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, '../scheduling.service.ts'), 'utf8');
const placement = readFileSync(join(__dirname, '../placement.service.ts'), 'utf8');

describe('factory lunch defaults', () => {
  it('seeds and one-shot upgrades 12:00–13:00 to 12:00–12:30', () => {
    expect(src).toContain('DEFAULT_FACTORY_BREAKS');
    expect(src).toContain('isLegacyHourLunch');
    expect(src).toContain("isLegacyLunch ? { breaks:");
    expect(placement).toContain("end: '12:30'");
    expect(placement).not.toMatch(/breaks: \[\{ start: '12:00', end: '13:00' \}\]/);
  });
});
