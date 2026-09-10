import { readFileSync } from 'fs';
import { join } from 'path';
import { translate } from '@/i18n/translate';

const workflowDir = join(__dirname, '..');

describe('manage stages floor', () => {
  it('uses parchment boards, rails, and header bands on stage cards', () => {
    const card = readFileSync(join(workflowDir, 'components/StageLibraryCard.tsx'), 'utf8');
    expect(card).toContain('orderBoardShadow');
    expect(card).toContain('width: 3');
    expect(card).toContain('surfaceSecondary');
    expect(card).toContain("t('common.details')");
    expect(card).toContain('StatusBadge');
    expect(card).toContain('ListItemEnter');
    expect(card).toContain('AnimatedPressable');
    expect(card).toContain("locale === 'ar' ? 'medium' : 'semibold'");
    expect(card).not.toContain('width: 88');
    expect(card).not.toContain('DeskCard');
    expect(card).not.toContain('SurfaceCard');
    expect(card).not.toContain('colors.info');
  });

  it('keeps section headers as slim DealerBoards with sibling cards', () => {
    const card = readFileSync(join(workflowDir, 'components/StageLibraryCard.tsx'), 'utf8');
    const home = readFileSync(join(workflowDir, 'ManageStagesScreen.tsx'), 'utf8');
    expect(card).toContain('DealerBoard');
    expect(card).toContain('sibling stage cards');
    expect(home).toContain('<StageLibrarySection');
    expect(home).toContain('<StageLibraryCard');
    expect(home).toContain('productionHint');
    expect(home).toContain('finishingHint');
    expect(home).toContain('openingHint');
    expect(home.indexOf('<StageLibrarySection')).toBeLessThan(home.indexOf('<StageLibraryCard'));
  });

  it('puts search in a chrome board and pins the editor footer', () => {
    const home = readFileSync(join(workflowDir, 'ManageStagesScreen.tsx'), 'utf8');
    expect(home).toContain('SearchBarShell');
    expect(home).toContain('DealerEmptyPanel');
    expect(home).toContain('DealerFormFooter');
    expect(home).toContain('DealerFormSection');
    expect(home).toContain('orderBoardShadow');
    expect(home).toContain('theme.radius.full');
    expect(home).toContain('theme.sizes.touch.min');
    expect(home).not.toContain('EmptyState');
    expect(home).not.toContain('PrimaryButton');
    expect(home).toContain("placeholder={t('mobile.production.workflow.searchStages')}");
  });

  it('marks selected sheet rows with a start rail', () => {
    const fields = readFileSync(join(workflowDir, 'components/StageEditorFields.tsx'), 'utf8');
    expect(fields).toContain('width: 3');
    expect(fields).toContain('colors.brandSoft');
    expect(fields).toContain("locale === 'ar' ? 'medium' : 'semibold'");
  });

  it('resolves section hints in EN, AR, and HE', () => {
    for (const key of [
      'mobile.production.workflow.openingHint',
      'mobile.production.workflow.productionHint',
      'mobile.production.workflow.finishingHint',
    ]) {
      for (const locale of ['en', 'ar', 'he'] as const) {
        expect(translate(locale, key)).not.toBe(key);
      }
    }
  });
});
