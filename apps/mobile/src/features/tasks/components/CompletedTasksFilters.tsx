import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { localizedName } from '@maher/i18n';
import { AppText } from '@/components/AppText';
import { TextField } from '@/components/forms/TextField';
import { ProductionDealerBar } from '@/features/production/components/ProductionDealerBar';
import {
  DealerPickerSheet,
  type DealerPickerOption,
} from '@/features/dealers/components/DealerPickerSheet';
import { formatDate, useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { CompletedDealerOption } from '../api';
import { CompletedDatePickerSheet } from './CompletedDatePickerSheet';
import { CompletedDateRail } from './CompletedDateRail';

export type CompletedDatePreset = 'all' | 'today' | 'week' | 'custom';

export type CompletedFiltersState = {
  q: string;
  dealerId: string | null;
  dealerName: string | null;
  datePreset: CompletedDatePreset;
  /** YYYY-MM-DD when datePreset === 'custom' */
  customDate: string;
};

type Props = {
  value: CompletedFiltersState;
  onChange: (next: CompletedFiltersState) => void;
  dealers: CompletedDealerOption[];
  dealersLoading?: boolean;
};

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysAgoYmd(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Map UI filter state → API query fields. */
export function completedFiltersToQuery(value: CompletedFiltersState): {
  q?: string;
  customerId?: string;
  completedFrom?: string;
  completedTo?: string;
} {
  const q = value.q.trim();
  let completedFrom: string | undefined;
  let completedTo: string | undefined;
  if (value.datePreset === 'today') {
    const t = todayYmd();
    completedFrom = t;
    completedTo = t;
  } else if (value.datePreset === 'week') {
    completedFrom = daysAgoYmd(6);
    completedTo = todayYmd();
  } else if (value.datePreset === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(value.customDate.trim())) {
    const d = value.customDate.trim();
    completedFrom = d;
    completedTo = d;
  }
  return {
    ...(q ? { q } : {}),
    ...(value.dealerId ? { customerId: value.dealerId } : {}),
    ...(completedFrom ? { completedFrom } : {}),
    ...(completedTo ? { completedTo } : {}),
  };
}

/**
 * Completed-tab filters — search, dealer, completion-date touch bar + floor calendar.
 */
export function CompletedTasksFilters({
  value,
  onChange,
  dealers,
  dealersLoading,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const [dealerOpen, setDealerOpen] = useState(false);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const dealerOptions = useMemo<DealerPickerOption[]>(
    () =>
      dealers.map((c) => {
        const name = localizedName(locale, c, c.code || c.name || '—');
        const searchText = [name, c.code, c.nameEn, c.nameAr, c.nameHe, c.name]
          .filter(Boolean)
          .join(' ');
        return { id: c.id, name, code: c.code, searchText };
      }),
    [dealers, locale],
  );

  const patch = (partial: Partial<CompletedFiltersState>) => {
    onChange({ ...value, ...partial });
  };

  const customLabel = (() => {
    if (value.datePreset !== 'custom') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.customDate.trim());
    if (!m) return null;
    return formatDate(
      locale,
      new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
    );
  })();

  const showCustomButton = value.datePreset === 'custom';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <TextField
        value={value.q}
        onChangeText={(q) => patch({ q })}
        placeholder={t('mobile.tasks.completedSearchPlaceholder')}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      <ProductionDealerBar
        label={value.dealerName}
        onPress={() => setDealerOpen(true)}
        onClear={
          value.dealerId
            ? () => patch({ dealerId: null, dealerName: null })
            : undefined
        }
      />

      <View style={{ gap: theme.spacing.xs }}>
        <AppText
          variant="caption"
          color="muted"
          style={{
            letterSpacing: locale === 'ar' ? 0 : 0.6,
            fontSize: 11,
          }}
        >
          {t('mobile.tasks.completedDateLabel')}
        </AppText>

        <CompletedDateRail
          value={value.datePreset}
          onChange={(datePreset) => patch({ datePreset })}
        />

        {showCustomButton ? (
          <View
            style={{
              marginTop: 2,
              borderRadius: theme.radius.xl,
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.brand,
              overflow: 'hidden',
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              ...theme.elevation.card,
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                ...(isRTL ? { right: 0 } : { left: 0 }),
                width: 3,
                backgroundColor: colors.brand,
                opacity: 0.85,
              }}
            />
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={
                customLabel ?? t('mobile.tasks.completedDateCustom')
              }
              onPress={() => {
                void haptics.selection();
                setDateSheetOpen(true);
              }}
              style={{
                flex: 1,
                minHeight: 48,
                paddingVertical: theme.spacing.sm,
                paddingHorizontal: theme.spacing.md,
                paddingLeft: isRTL ? theme.spacing.md : theme.spacing.md + 4,
                paddingRight: isRTL ? theme.spacing.md + 4 : theme.spacing.md,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.surface,
                  borderWidth: 1,
                  borderColor: colors.brand,
                }}
              >
                <Ionicons name="calendar-outline" size={16} color={colors.brand} />
              </View>

              <View
                style={{
                  flex: 1,
                  gap: 2,
                  alignItems: isRTL ? 'flex-end' : 'flex-start',
                  minWidth: 0,
                }}
              >
                <AppText
                  variant="caption"
                  color="muted"
                  numberOfLines={1}
                  style={{
                    letterSpacing: locale === 'ar' ? 0 : 0.6,
                    textTransform: locale === 'ar' ? 'none' : 'uppercase',
                    fontSize: 11,
                    lineHeight: 14,
                  }}
                >
                  {t('mobile.tasks.completedDateLabel')}
                </AppText>
                <AppText
                  variant="label"
                  weight={titleWeight}
                  numberOfLines={1}
                  style={{ color: colors.brand }}
                >
                  {customLabel ?? t('mobile.tasks.completedDateCustom')}
                </AppText>
              </View>

              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color={colors.textMuted}
              />
            </AnimatedPressable>
          </View>
        ) : null}
      </View>

      <DealerPickerSheet
        open={dealerOpen}
        onClose={() => setDealerOpen(false)}
        title={t('mobile.production.filterDealerTitle')}
        searchPlaceholder={t('mobile.production.filterDealerSearch')}
        emptyLabel={t('mobile.tasks.completedDealerEmpty')}
        allLabel={t('mobile.production.filterDealerAll')}
        dealers={dealerOptions}
        selectedId={value.dealerId}
        loading={dealersLoading}
        mode="immediate"
        onSelect={(dealer) => {
          patch({
            dealerId: dealer?.id ?? null,
            dealerName: dealer?.name ?? null,
          });
          setDealerOpen(false);
        }}
      />

      <CompletedDatePickerSheet
        open={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        value={value.customDate}
        onConfirm={(customDate) => {
          patch({ datePreset: 'custom', customDate });
          setDateSheetOpen(false);
        }}
      />
    </View>
  );
}
