import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { AppTextInput } from '@/components/forms/AppTextInput';
import { SearchBarShell } from '@/components/forms/SearchBarShell';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { DealerBoard } from '@/features/dealers/components/DealerBoard';
import {
  DealerFloorRow,
  type DealerPickerOption,
} from '@/features/dealers/components/DealerPickerSheet';
import { DealerFormFooter } from '@/features/dealers/components/dealerSheetForm';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { resolveAppFontStyle, useTheme } from '@/theme';

export type SchedulingReadinessFilter = 'all' | 'ready' | 'needsPlanning';

export type SchedulingDealerPick = {
  id: string;
  name: string;
  names: string[];
};

export type SchedulingDealerOption = DealerPickerOption & { names: string[] };

type Props = {
  open: boolean;
  onClose: () => void;
  dealers: SchedulingDealerOption[];
  loading?: boolean;
  dealer: SchedulingDealerPick | null;
  readiness: SchedulingReadinessFilter;
  onApply: (next: { dealer: SchedulingDealerPick | null; readiness: SchedulingReadinessFilter }) => void;
};

const READINESS: Array<{
  key: SchedulingReadinessFilter;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'all', labelKey: 'mobile.adminScheduling.filter.readinessAll', icon: 'apps-outline' },
  { key: 'ready', labelKey: 'mobile.adminScheduling.filter.readinessReady', icon: 'checkmark-circle-outline' },
  { key: 'needsPlanning', labelKey: 'mobile.adminScheduling.filter.readinessNeeds', icon: 'construct-outline' },
];

function filterDealers(dealers: SchedulingDealerOption[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return dealers;
  return dealers.filter((row) => {
    const hay = `${row.name} ${row.code ?? ''} ${row.searchText ?? ''}`.toLowerCase();
    return hay.includes(needle);
  });
}

export function SchedulingFilterSheet({
  open,
  onClose,
  dealers,
  loading,
  dealer,
  readiness,
  onApply,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const { height } = useWindowDimensions();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [query, setQuery] = useState('');
  const [draftDealer, setDraftDealer] = useState<SchedulingDealerPick | null>(dealer);
  const [draftReadiness, setDraftReadiness] = useState<SchedulingReadinessFilter>(readiness);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    setDraftDealer(dealer);
    setDraftReadiness(readiness);
    setQuery('');
  }, [open, dealer, readiness]);

  const filtered = useMemo(() => filterDealers(dealers, query), [dealers, query]);

  const commit = () => {
    onApply({ dealer: draftDealer, readiness: draftReadiness });
    onClose();
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      expandable
      sheetHeight={Math.round(height * 0.88)}
      title={t('mobile.adminScheduling.filters')}
    >
      <View style={{ flex: 1, minHeight: 0, gap: theme.spacing.md }}>
        <DealerBoard title={t('mobile.adminScheduling.filter.readiness')} titleWeight={titleWeight}>
          <View style={{ gap: theme.spacing.sm }}>
            {READINESS.map((item) => {
              const active = draftReadiness === item.key;
              const label = t(item.labelKey);
              return (
                <AnimatedPressable
                  key={item.key}
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  onPress={() => {
                    void haptics.selection();
                    setDraftReadiness(item.key);
                  }}
                  style={{
                    minHeight: 52,
                    borderRadius: theme.radius.lg,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.borderStrong,
                    backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
                    paddingHorizontal: theme.spacing.md,
                    overflow: 'hidden',
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    gap: theme.spacing.sm,
                  }}
                >
                  {active ? (
                    <View
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: 3,
                        backgroundColor: colors.brand,
                        ...(isRTL ? { right: 0 } : { left: 0 }),
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: colors.surface,
                      borderWidth: 1,
                      borderColor: active ? colors.brand : colors.border,
                    }}
                  >
                    <Ionicons
                      name={item.icon}
                      size={14}
                      color={active ? colors.brand : colors.textSecondary}
                    />
                  </View>
                  <AppText weight={titleWeight} style={{ flex: 1 }}>
                    {label}
                  </AppText>
                  {active ? (
                    <Ionicons name="checkmark" size={16} color={colors.brand} />
                  ) : null}
                </AnimatedPressable>
              );
            })}
          </View>
        </DealerBoard>

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
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
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
                letterSpacing: locale === 'ar' ? 0 : 0.7,
                fontSize: 11,
                color: colors.brand,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('mobile.adminScheduling.filter.dealer')}
            </AppText>
            <AppText variant="caption" color="muted" dir="ltr">
              {String(filtered.length)}
            </AppText>
          </View>

          <View style={{ padding: theme.spacing.sm, paddingBottom: 0 }}>
            <SearchBarShell>
              <AppTextInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('mobile.adminScheduling.filter.searchDealers')}
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
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

          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: theme.spacing.sm,
              gap: theme.spacing.sm,
              paddingBottom: theme.spacing.md,
            }}
          >
            <DealerFloorRow
              label={t('mobile.adminScheduling.filter.allDealers')}
              icon="apps-outline"
              active={draftDealer == null}
              muted
              isRTL={isRTL}
              titleWeight={titleWeight}
              onPress={() => {
                void haptics.selection();
                setDraftDealer(null);
              }}
            />
            {filtered.map((row) => (
              <DealerFloorRow
                key={row.id}
                label={row.name}
                meta={row.code}
                icon="storefront-outline"
                active={draftDealer?.id === row.id}
                isRTL={isRTL}
                titleWeight={titleWeight}
                onPress={() => {
                  void haptics.selection();
                  setDraftDealer({
                    id: row.id,
                    name: row.name,
                    names: row.names,
                  });
                }}
              />
            ))}
            {loading ? (
              <AppText variant="caption" color="muted" style={{ padding: theme.spacing.md }}>
                {t('mobile.adminScheduling.filter.loadingDealers')}
              </AppText>
            ) : null}
            {!loading && filtered.length === 0 ? (
              <AppText
                variant="caption"
                color="muted"
                style={{ padding: theme.spacing.md, textAlign: 'center' }}
              >
                {t('mobile.adminScheduling.filter.noDealersMatch')}
              </AppText>
            ) : null}
          </ScrollView>
        </View>

        <DealerFormFooter
          confirmLabel={t('mobile.adminScheduling.filter.done')}
          onConfirm={commit}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}
