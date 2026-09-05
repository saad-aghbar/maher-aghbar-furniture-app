import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkflowListItem } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerEmptyPanel } from '@/features/dealers/components/DealerEmptyPanel';
import { productionInsetStyle } from '@/features/production/productionFloorStyle';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { workflowDisplayName } from '@/features/sales-orders/production-setup/workflowDisplayName';
import { useWorkflowsQuery } from '@/features/workflow/query';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';

type Props = {
  open: boolean;
  onClose: () => void;
  selectedId: string | null;
  onPick: (workflow: WorkflowListItem) => void;
};

function isPublished(wf: WorkflowListItem): boolean {
  const status = String(wf.status ?? '').toUpperCase();
  if (status === 'ARCHIVED' || status === 'DRAFT') return false;
  return Boolean(wf.activeVersion?.id);
}

/**
 * Floor workflow picker — parchment chrome, header band, rail rows, sentence-case names.
 */
export function WorkflowPickerSheet({
  open,
  onClose,
  selectedId,
  onPick,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.72), 640);
  const [q, setQ] = useState('');
  const workflowsQuery = useWorkflowsQuery(open);

  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const rows = useMemo(() => {
    const all = (workflowsQuery.data ?? []).filter(isPublished);
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((wf) => {
      const name = workflowDisplayName(locale, wf).toLowerCase();
      return (
        name.includes(needle) ||
        wf.code.toLowerCase().includes(needle) ||
        wf.nameEn?.toLowerCase().includes(needle) ||
        wf.nameAr?.toLowerCase().includes(needle) ||
        (wf.nameHe ?? '').toLowerCase().includes(needle)
      );
    });
  }, [workflowsQuery.data, q, locale]);

  const empty = !workflowsQuery.isLoading && rows.length === 0;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.productionSetup.pickWorkflow')}
      sheetHeight={sheetHeight}
    >
      <View style={{ flex: 1, minHeight: 0, gap: theme.spacing.md }}>
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
              padding: theme.spacing.sm,
              ...(isRTL
                ? { paddingRight: theme.spacing.sm + 4 }
                : { paddingLeft: theme.spacing.sm + 4 }),
            }}
          >
            <SearchBarShell>
              <AppTextInput
                value={q}
                onChangeText={setQ}
                placeholder={t('mobile.productionSetup.searchWorkflows')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
                accessibilityLabel={t('mobile.productionSetup.searchWorkflows')}
                style={{
                  flex: 1,
                  minWidth: 0,
                  paddingVertical: theme.spacing.sm,
                  fontSize: 16,
                  color: colors.textPrimary,
                  textAlign: isRTL ? 'right' : 'left',
                  ...resolveAppFontStyle(locale, { variant: 'body' }),
                }}
              />
            </SearchBarShell>
          </View>
        </View>

        <View
          style={{
            flex: 1,
            minHeight: 0,
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
              paddingVertical: theme.spacing.sm + 2,
              ...(isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }),
              backgroundColor: colors.surfaceSecondary,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: colors.border,
            }}
          >
            <AppText
              variant="caption"
              weight={titleWeight}
              style={{
                fontSize: 11,
                color: colors.brand,
                letterSpacing: locale === 'ar' ? 0 : 0.2,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.productionSetup.workflowListTitle')}
            </AppText>
            {workflowsQuery.isLoading ? null : (
              <AppText variant="caption" color="muted">
                {String(rows.length)}
              </AppText>
            )}
          </View>

          {workflowsQuery.isLoading ? (
            <View
              style={{
                flex: 1,
                minHeight: 160,
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: theme.spacing.xl,
              }}
            >
              <ActivityIndicator color={colors.brand} />
            </View>
          ) : (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              style={{ flex: 1 }}
              contentContainerStyle={{
                padding: theme.spacing.sm,
                gap: theme.spacing.sm,
                paddingBottom: theme.spacing.md,
                ...(isRTL
                  ? { paddingRight: theme.spacing.sm + 4 }
                  : { paddingLeft: theme.spacing.sm + 4 }),
                flexGrow: empty ? 1 : undefined,
              }}
            >
              {empty ? (
                <DealerEmptyPanel
                  nested
                  compact
                  icon="git-branch-outline"
                  text={t('mobile.productionSetup.noWorkflows')}
                />
              ) : (
                rows.map((item, index) => {
                  const selected = item.id === selectedId;
                  const name = workflowDisplayName(locale, item);
                  const stageCount = item.activeVersion?._count?.nodes ?? null;
                  const versionNumber = item.activeVersion?.versionNumber ?? null;
                  const metaBits: string[] = [];
                  if (stageCount != null) {
                    metaBits.push(t('mobile.productionSetup.stageCount', { n: stageCount }));
                  }
                  if (versionNumber != null) {
                    metaBits.push(
                      t('mobile.productionSetup.versionLabel', { n: versionNumber }),
                    );
                  }
                  return (
                    <ListItemEnter key={item.id} index={index}>
                      <WorkflowFloorRow
                        title={name}
                        meta={metaBits.length > 0 ? metaBits.join(' · ') : null}
                        selected={selected}
                        isRTL={isRTL}
                        titleWeight={titleWeight}
                        onPress={() => {
                          void haptics.selection();
                          onPick(item);
                          onClose();
                        }}
                      />
                    </ListItemEnter>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </BottomSheet>
  );
}

function WorkflowFloorRow({
  title,
  meta,
  selected,
  isRTL,
  titleWeight,
  onPress,
}: {
  title: string;
  meta: string | null;
  selected: boolean;
  isRTL: boolean;
  titleWeight: 'medium' | 'semibold';
  onPress: () => void;
}) {
  const { colors, theme, colorScheme } = useTheme();
  const { locale } = useLocale();

  return (
    <AnimatedPressable
      variant="card"
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: selected ? 1.5 : 1,
        borderColor: selected ? colors.brand : colors.borderStrong,
        backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 8,
          bottom: 8,
          width: 3,
          borderRadius: 2,
          backgroundColor: colors.brand,
          opacity: selected ? 0.9 : 0.55,
          ...(isRTL ? { right: 0 } : { left: 0 }),
        }}
      />
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: selected ? colors.surface : colors.brandSoft,
            borderWidth: 1,
            borderColor: selected ? colors.brand : colors.border,
          }}
        >
          <Ionicons
            name="git-branch-outline"
            size={18}
            color={selected ? colors.brand : colors.textSecondary}
          />
        </View>
        <View style={{ flex: 1, gap: theme.spacing.xs, minWidth: 0 }}>
          <AppText
            variant="label"
            weight={selected ? titleWeight : 'medium'}
            numberOfLines={2}
            style={{
              color: selected ? colors.brand : colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {title}
          </AppText>
          {meta ? (
            <View
              style={[
                productionInsetStyle(theme, colors),
                {
                  paddingVertical: 6,
                  paddingHorizontal: theme.spacing.sm,
                  gap: 0,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={1}
                style={{
                  textAlign: isRTL ? 'right' : 'left',
                  fontSize: 11,
                  letterSpacing: locale === 'ar' ? 0 : 0.15,
                }}
              >
                {meta}
              </AppText>
            </View>
          ) : null}
        </View>
        {selected ? (
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand,
            }}
          >
            <Ionicons name="checkmark" size={16} color={colors.onBrand} />
          </View>
        ) : (
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={16}
            color={colors.textMuted}
          />
        )}
      </View>
    </AnimatedPressable>
  );
}
