import { readFileSync } from 'fs';
import { join } from 'path';
import type { WorkflowListItem } from '@/api/modules/workflow';
import {
  filterWorkflowsForPicker,
  matchesWorkflowScopeFilter,
} from '../workflowScope';

function wf(
  over: Partial<WorkflowListItem> & Pick<WorkflowListItem, 'id' | 'code'>,
): WorkflowListItem {
  return {
    nameAr: over.nameAr ?? over.code,
    nameEn: over.nameEn ?? over.code,
    status: 'PUBLISHED',
    activeVersion: {
      id: `${over.id}-v`,
      versionNumber: 1,
      status: 'PUBLISHED',
      _count: { nodes: 4, edges: 3 },
    },
    ...over,
  };
}

const STANDARD = wf({
  id: 'std',
  code: 'STD_FURNITURE',
  nameEn: 'Standard furniture workflow',
  nameAr: 'سير أثاث قياسي',
  scope: 'STANDARD',
});
const RETURN = wf({
  id: 'ret',
  code: 'RETURN_REPAIR',
  nameEn: 'Return repair',
  nameAr: 'إصلاح مرتجع',
  scope: 'RETURN',
});
const DRAFT = wf({
  id: 'draft',
  code: 'DRAFT_PATH',
  nameEn: 'Unpublished',
  activeVersion: null,
  scope: 'STANDARD',
});

describe('workflow picker filters', () => {
  it('treats All as unfiltered, Normal as non-return, Return as return/recovery', () => {
    expect(matchesWorkflowScopeFilter('STANDARD', null)).toBe(true);
    expect(matchesWorkflowScopeFilter('RETURN', null)).toBe(true);
    expect(matchesWorkflowScopeFilter('STANDARD', 'STANDARD')).toBe(true);
    expect(matchesWorkflowScopeFilter('RETURN', 'STANDARD')).toBe(false);
    expect(matchesWorkflowScopeFilter('RECOVERY', 'STANDARD')).toBe(false);
    expect(matchesWorkflowScopeFilter('RETURN', 'RETURN')).toBe(true);
    expect(matchesWorkflowScopeFilter('RECOVERY', 'RETURN')).toBe(true);
    expect(matchesWorkflowScopeFilter('STANDARD', 'RETURN')).toBe(false);
    expect(matchesWorkflowScopeFilter(undefined, 'STANDARD')).toBe(true);
  });

  it('drops unpublished paths and matches search on name or code', () => {
    const rows = filterWorkflowsForPicker([STANDARD, RETURN, DRAFT], {
      query: 'repair',
      locale: 'en',
      scopeFilter: null,
    });
    expect(rows.map((row) => row.id)).toEqual(['ret']);

    const byCode = filterWorkflowsForPicker([STANDARD, RETURN], {
      query: 'std_furn',
      locale: 'en',
      scopeFilter: null,
    });
    expect(byCode.map((row) => row.id)).toEqual(['std']);
  });

  it('filters by All / Normal / Return and sorts preferred scope first', () => {
    const all = filterWorkflowsForPicker([RETURN, STANDARD], {
      query: '',
      locale: 'en',
      scopeFilter: null,
      preferredScope: 'STANDARD',
    });
    expect(all.map((row) => row.id)).toEqual(['std', 'ret']);

    const normal = filterWorkflowsForPicker([STANDARD, RETURN], {
      query: '',
      locale: 'en',
      scopeFilter: 'STANDARD',
    });
    expect(normal.map((row) => row.id)).toEqual(['std']);

    const returned = filterWorkflowsForPicker([STANDARD, RETURN], {
      query: '',
      locale: 'en',
      scopeFilter: 'RETURN',
    });
    expect(returned.map((row) => row.id)).toEqual(['ret']);
  });

  it('matches Arabic names when the UI locale is Arabic', () => {
    const rows = filterWorkflowsForPicker([STANDARD, RETURN], {
      query: 'مرتجع',
      locale: 'ar',
      scopeFilter: null,
    });
    expect(rows.map((row) => row.id)).toEqual(['ret']);
  });
});

describe('WorkflowPickDesk floor', () => {
  const dir = join(__dirname, '..');

  it('uses the All / Normal / Return bar, search, and capped nested scroll', () => {
    const desk = readFileSync(join(dir, 'components/WorkflowPickDesk.tsx'), 'utf8');
    const variant = readFileSync(
      join(dir, '../catalog/AdminVariantDetailScreen.tsx'),
      'utf8',
    );
    const assign = readFileSync(join(dir, 'components/AssignOrderWorkflowCard.tsx'), 'utf8');
    const product = readFileSync(join(dir, 'components/ProductWorkflowSection.tsx'), 'utf8');
    const plan = readFileSync(
      join(dir, '../sales-orders/OrderProductionPlanEditorScreen.tsx'),
      'utf8',
    );
    expect(desk).toContain('WorkflowScopeTouchBar');
    expect(desk).toContain('InventorySearchField');
    expect(desk).toContain('CappedNestedScroll');
    expect(desk).toContain('FLOOR_ROW_ESTIMATE.workflow');
    expect(desk).toContain('visibleRows');
    expect(desk).not.toContain('DeskCard');
    expect(desk).not.toContain('SurfaceCard');
    expect(desk).not.toContain("fontWeight: '700'");
    expect(variant).toContain('WorkflowPickDesk');
    expect(variant).toContain('embedded');
    expect(assign).toContain('WorkflowPickDesk');
    expect(product).toContain('WorkflowPickDesk');
    expect(plan).toContain('AssignOrderWorkflowCard');
    expect(plan).toContain('WorkflowPickDesk');
    expect(plan).not.toContain('WorkflowPickerSheet');
  });
});
