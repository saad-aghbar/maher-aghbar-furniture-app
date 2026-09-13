import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import type { WorkflowListItem, WorkflowScope } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import {
  CappedNestedScroll,
  CatalogFloorEmpty,
  CatalogFloorListHeader,
  FLOOR_ROW_ESTIMATE,
} from '@/features/catalog/components/CatalogFloorList';
import { InventorySearchField } from '@/features/inventory/components/InventorySearchField';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { WorkflowScopeTouchBar } from './WorkflowScopeTouchBar';
import { WorkflowFloorRow } from './WorkflowFloorList';
import { filterWorkflowsForPicker, workflowScopeLabelKey } from '../workflowScope';

type Props = {
  workflows: WorkflowListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading?: boolean;
  /** When true, tapping the already-selected row still fires onSelect. */
  selectAgain?: boolean;
  /** Skip the outer chrome board when the parent already is one. */
  embedded?: boolean;
  preferredScope?: WorkflowScope;
  initialScope?: WorkflowScope | null;
  visibleRows?: number;
};

/**
 * Floor picker: All / Normal / Return touch bar, search, and a capped scroll of paths.
 */
export function WorkflowPickDesk({
  workflows,
  selectedId,
  onSelect,
  loading = false,
  selectAgain = false,
  embedded = false,
  preferredScope,
  initialScope = null,
  visibleRows = 4,
}: Props) {
  const { t, locale, isRTL } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [query, setQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<WorkflowScope | null>(initialScope);

  const filtered = useMemo(
    () =>
      filterWorkflowsForPicker(workflows, {
        query,
        locale,
        scopeFilter,
        preferredScope,
      }),
    [locale, preferredScope, query, scopeFilter, workflows],
  );

  const publishedCount = workflows.filter((wf) => Boolean(wf.activeVersion)).length;

  const chrome = (
    <>
      <WorkflowScopeTouchBar value={scopeFilter} onChange={setScopeFilter} />
      <InventorySearchField
        value={query}
        onChangeText={setQuery}
        placeholder={t('mobile.production.workflow.searchWorkflows')}
      />
    </>
  );

  let body: ReactNode;
  if (loading) {
    body = <AppText color="muted">{t('mobile.production.loadingMore')}</AppText>;
  } else if (publishedCount === 0) {
    body = (
      <CatalogFloorEmpty
        icon="git-network-outline"
        message={t('mobile.production.workflow.emptyWorkflowHint')}
      />
    );
  } else if (filtered.length === 0) {
    body = (
      <CatalogFloorEmpty
        icon="search-outline"
        message={t('mobile.production.workflow.noWorkflowMatches')}
      />
    );
  } else {
    body = (
      <View style={{ gap: theme.spacing.sm }}>
        {embedded ? (
          <CatalogFloorListHeader
            title={t('mobile.productionSetup.workflowListTitle')}
            count={filtered.length}
          />
        ) : null}
        <CappedNestedScroll
          itemCount={filtered.length}
          rowEstimate={FLOOR_ROW_ESTIMATE.workflow}
          gap={theme.spacing.sm}
          visibleRows={visibleRows}
        >
          {filtered.map((wf) => {
            const active = selectedId === wf.id;
            const scopeLabel = t(workflowScopeLabelKey(wf.scope));
            const meta = wf.activeVersion
              ? `${scopeLabel} · ${t('mobile.production.workflow.cardMeta', {
                  version: wf.activeVersion.versionNumber,
                  stages: wf.activeVersion._count?.nodes ?? 0,
                })}`
              : `${scopeLabel} · ${t('mobile.production.workflow.draftVersion')}`;
            return (
              <WorkflowFloorRow
                key={wf.id}
                label={localizedName(locale, wf, wf.code)}
                meta={meta}
                active={active}
                showChevron={false}
                trailing={
                  active ? (
                    <Ionicons name="checkmark" size={18} color={colors.brand} />
                  ) : null
                }
                onPress={() => {
                  void haptics.selection();
                  if (active && !selectAgain) return;
                  onSelect(wf.id);
                }}
              />
            );
          })}
        </CappedNestedScroll>
      </View>
    );
  }

  if (embedded) {
    return (
      <View style={{ gap: theme.spacing.md }}>
        <View
          style={{
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          {chrome}
        </View>
        {body}
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor: colors.surface,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: colors.brand,
          opacity: 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.lg + 4 }
            : { paddingLeft: theme.spacing.lg + 4 }),
          paddingVertical: theme.spacing.sm + 2,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        }}
      >
        <AppText
          variant="caption"
          weight={titleWeight}
          style={{
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            letterSpacing: locale === 'ar' ? 0 : 0.5,
            fontSize: 11,
            color: colors.brand,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {t('mobile.production.workflow.scopeSection')}
        </AppText>
        {filtered.length > 0 || publishedCount > 0 ? (
          <AppText variant="caption" color="muted" dir="ltr">
            {String(loading ? publishedCount : filtered.length)}
          </AppText>
        ) : null}
      </View>
      <View
        style={{
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        {chrome}
        {body}
      </View>
    </View>
  );
}
