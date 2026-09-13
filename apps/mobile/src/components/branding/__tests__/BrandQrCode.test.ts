import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const brandingDir = join(__dirname, '..');
const mobileSrc = join(__dirname, '../../..');
const mobileApp = join(__dirname, '../../../../app');
const brandQrSrc = readFileSync(join(brandingDir, 'BrandQrCode.tsx'), 'utf8');

function walkTs(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTs(full));
    else if (name.endsWith('.tsx') || name.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('BrandQrCode', () => {
  it('uses H correction, high-contrast modules, and the sofa M mark', () => {
    expect(brandQrSrc).toContain("export const BRAND_QR_ECL = 'H'");
    expect(brandQrSrc).toContain('ecl={BRAND_QR_ECL}');
    expect(brandQrSrc).toContain("export const BRAND_QR_COLOR = '#1A1A1A'");
    expect(brandQrSrc).toContain("export const BRAND_QR_BACKGROUND = '#FFFFFF'");
    expect(brandQrSrc).toContain('watermark-mark.png');
    expect(brandQrSrc).toContain('logo={MARK}');
    expect(brandQrSrc).toContain('logoBackgroundColor={BRAND_QR_BACKGROUND}');
    expect(brandQrSrc).toContain('BRAND_QR_LOGO_RATIO = 0.26');
    expect(brandQrSrc).not.toContain('logomark-on-light');
    expect(brandQrSrc).not.toContain('EST. 1995');
  });

  it('is the only react-native-qrcode-svg import in the mobile app', () => {
    const files = [...walkTs(mobileSrc), ...walkTs(mobileApp)];
    const hits = files.filter((file) => {
      const src = readFileSync(file, 'utf8');
      return /from ['"]react-native-qrcode-svg['"]/.test(src);
    });
    expect(hits).toEqual([join(brandingDir, 'BrandQrCode.tsx')]);
  });
});
