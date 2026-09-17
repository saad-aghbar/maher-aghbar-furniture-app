import { lightTheme } from '@/theme';
import { carouselCardWidth, densityFor } from '../density';

describe('densityFor', () => {
  it('COMPACT reproduces the phone floor exactly (lg padding, xl boards, no chrome widths)', () => {
    const d = densityFor('compact', lightTheme);
    expect(d.pagePaddingH).toBe(lightTheme.spacing.lg);
    expect(d.sectionGap).toBe(lightTheme.spacing.lg);
    expect(d.boardGap).toBe(lightTheme.spacing.md);
    expect(d.boardRadius).toBe(lightTheme.radius.xl);
    expect(d.contentMaxWidth).toBeUndefined();
    expect(d.railWidth).toBe(0);
    expect(d.sidebarWidth).toBe(0);
    expect(d.paneGap).toBe(0);
  });

  it('gets denser as the window grows', () => {
    const c = densityFor('compact', lightTheme);
    const m = densityFor('medium', lightTheme);
    const e = densityFor('expanded', lightTheme);
    const w = densityFor('wide', lightTheme);
    expect(m.rowMinHeight).toBeLessThan(c.rowMinHeight);
    expect(e.rowMinHeight).toBeLessThan(m.rowMinHeight);
    expect(w.rowMinHeight).toBeLessThan(e.rowMinHeight);
    expect(e.boardRadius).toBeLessThan(c.boardRadius);
    expect(w.boardRadius).toBeLessThanOrEqual(e.boardRadius);
    expect(m.sectionGap).toBeLessThanOrEqual(c.sectionGap);
  });

  it('only expanded and wide carry a sidebar; medium carries a rail', () => {
    expect(densityFor('medium', lightTheme).railWidth).toBeGreaterThan(0);
    expect(densityFor('medium', lightTheme).sidebarWidth).toBe(0);
    expect(densityFor('expanded', lightTheme).sidebarWidth).toBeGreaterThan(0);
    expect(densityFor('wide', lightTheme).sidebarWidth).toBeGreaterThanOrEqual(
      densityFor('expanded', lightTheme).sidebarWidth,
    );
  });

  it('caps content width on large windows and keeps every value a theme-derived number', () => {
    for (const wc of ['medium', 'expanded', 'wide'] as const) {
      const d = densityFor(wc, lightTheme);
      expect(d.contentMaxWidth).toBeGreaterThan(800);
      expect(d.dialogMaxWidth).toBeGreaterThan(0);
      expect(d.panelWidth).toBeGreaterThan(0);
      for (const value of Object.values(d)) {
        if (value !== undefined) expect(Number.isFinite(value)).toBe(true);
      }
    }
  });

  it('carouselCardWidth keeps compact tiles and grows on larger windows', () => {
    expect(carouselCardWidth('compact', 156)).toBe(156);
    expect(carouselCardWidth('medium', 156)).toBeGreaterThan(156);
    expect(carouselCardWidth('wide', 156)).toBeGreaterThan(carouselCardWidth('expanded', 156));
  });
});
