import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import type { WorkflowListItem } from '@/api/modules/workflow';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useWorkflowsQuery } from '@/features/workflow/query';
import { useLocale } from '@/i18n';
import { haptics } from '@/motion';
import { useTheme } from '@/theme';
import { orderBoardShadow } from '../../components/orderFloorStyle';

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

export function WorkflowPickerSheet({
  open,
  onClose,
  selectedId,
  onPick,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.62), 560);
  const [q, setQ] = useState('');
  const workflowsQuery = useWorkflowsQuery(open);

  const rows = useMemo(() => {
    const all = (workflowsQuery.data ?? []).filter(isPublished);
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((wf) => {
      const name = localizedName(locale, wf, wf.code).toLowerCase();
      return (
        name.includes(needle) ||
        wf.code.toLowerCase().includes(needle) ||
        wf.nameEn?.toLowerCase().includes(needle) ||
        wf.nameAr?.toLowerCase().includes(needle)
      );
    });
  }, [workflowsQuery.data, q, locale]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.productionSetup.pickWorkflow')}
      sheetHeight={sheetHeight}
    >
      <View style={{ flex: 1, gap: theme.spacing.md }}>
        <SearchBarShell>
          <AppTextInput
            value={q}
            onChangeText={setQ}
            placeholder={t('mobile.productionSetup.searchWorkflows')}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            style={{
              flex: 1,
              paddingVertical: theme.spacing.sm,
              color: colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          />
        </SearchBarShell>
        {workflowsQuery.isLoading ? (
          <View style={{ paddingVertical: theme.spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.brand} />
          </View>
        ) : rows.length === 0 ? (
          <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
            {t('mobile.productionSetup.noWorkflows')}
          </AppText>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: theme.spacing.sm, paddingBottom: 24 }}
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              const name = localizedName(locale, item, item.code);
              const stageCount = item.activeVersion?._count?.nodes ?? null;
              const versionNumber = item.activeVersion?.versionNumber ?? null;
              return (
                <Pressable
                  onPress={() => {
                    void haptics.selection();
                    onPick(item);
                    onClose();
                  }}
                  style={{
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: selected ? colors.brand : colors.borderStrong,
                    backgroundColor: selected ? colors.brandSoft : colors.surface,
                    padding: theme.spacing.md,
                    gap: 4,
                    ...orderBoardShadow(colorScheme),
                  }}
                >
                  <View
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      gap: theme.spacing.sm,
                    }}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? colors.brand : colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <AppText variant="label" weight="semibold">
                        {name}
                      </AppText>
                      <AppText variant="caption" color="secondary" dir="ltr">
                        {item.code}
                        {stageCount != null
                          ? ` · ${t('mobile.productionSetup.stageCount', {
                              n: stageCount,
                            })}`
                          : ''}
                        {versionNumber != null ? ` · v${versionNumber}` : ''}
                      </AppText>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </BottomSheet>
  );
}
