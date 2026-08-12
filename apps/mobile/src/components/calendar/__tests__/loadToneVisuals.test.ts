import { lightColors, darkColors } from '@/theme/colors';
import { ADMIN_LOAD_LEGEND, resolveAdminLoadVisual } from '../loadToneVisuals';

describe('resolveAdminLoadVisual', () => {
  it('returns distinct fills for every legend key (light)', () => {
    const fills = ADMIN_LOAD_LEGEND.map((key) => resolveAdminLoadVisual(key, lightColors).bg);
    expect(new Set(fills).size).toBe(ADMIN_LOAD_LEGEND.length);
  });

  it('returns distinct fills for every legend key (dark)', () => {
    const fills = ADMIN_LOAD_LEGEND.map((key) => resolveAdminLoadVisual(key, darkColors).bg);
    expect(new Set(fills).size).toBe(ADMIN_LOAD_LEGEND.length);
  });

  it('keeps legend swatch identical to cell background', () => {
    for (const key of ADMIN_LOAD_LEGEND) {
      const visual = resolveAdminLoadVisual(key, lightColors);
      expect(visual.swatch).toBe(visual.bg);
    }
  });

  it('maps unavailable to closed visuals', () => {
    const closed = resolveAdminLoadVisual('closed', lightColors);
    const unavailable = resolveAdminLoadVisual('unavailable', lightColors);
    expect(unavailable.bg).toBe(closed.bg);
    expect(unavailable.border).toBe(closed.border);
  });
});
