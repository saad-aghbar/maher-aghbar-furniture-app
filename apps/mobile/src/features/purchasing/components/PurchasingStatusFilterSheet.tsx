import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '@/components/AppText';
import { PrimaryButton } from '@/components/buttons/PrimaryButton';
import { SecondaryButton } from '@/components/buttons/SecondaryButton';
import { DatePickerField } from '@/components/calendar/DatePickerField';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, useReducedMotion } from '@/motion';
import { useTheme } from '@/theme';
import { isStatusFilterActive } from '../purchasingFilters';
import { toggleExclusiveValue } from '../purchasingToggle';
import {
  PurchasingWarehousePickList,
  type PurchasingWarehouseOption,
} from './PurchasingWarehousePickList';

type Props = {
  open: boolean;
  onClose: () => void;
  statuses: readonly string[];
  status: string;
  dateFrom?: string;
  dateTo?: string;
  hideDates?: boolean;
  warehouses?: PurchasingWarehouseOption[];
  warehouseId?: string;
  onApply: (next: {
    status: string;
    dateFrom?: string;
    dateTo?: string;
    warehouseId?: string;
  }) => void;
};

export function PurchasingStatusFilterSheet({
  open,
  onClose,
  statuses,
  status,
  dateFrom = '',
  dateTo = '',
  hideDates = false,
  warehouses = [],
  warehouseId,
  onApply,
}: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const reduce = useReducedMotion();
  const { height } = useWindowDimensions();
  const sheetHeight = Math.min(Math.round(height * 0.72), 600);
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const [draft, setDraft] = useState(status);
  const [draftFrom, setDraftFrom] = useState(dateFrom);
  const [draftTo, setDraftTo] = useState(dateTo);
  const [draftWarehouse, setDraftWarehouse] = useState(warehouseId ?? '');

  useEffect(() => {
    if (open) {
      setDraft(status);
      setDraftFrom(dateFrom);
      setDraftTo(dateTo);
      setDraftWarehouse(warehouseId ?? '');
    }
  }, [open, status, dateFrom, dateTo, warehouseId]);

  const statusLabel = (s: string) => {
    if (s === 'ALL') return t('common.all');
    const key = `statuses.${s}`;
    const translated = t(key);
    return translated === key ? s : translated;
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.purchasing.filterTitle')}
      expandable
      sheetHeight={sheetHeight}
    >
      <ScrollView
        contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}
      >
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
            overflow: 'hidden',
          }}
        >
          {isStatusFilterActive(draft) ? (
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
          ) : null}
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <Ionicons name="funnel-outline" size={16} color={colors.brand} />
            <AppText
              variant="caption"
              style={{
                flex: 1,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                fontSize: 11,
                color: colors.brand,
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {t('common.status')}
            </AppText>
          </View>
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              flexWrap: 'wrap',
              gap: theme.spacing.sm,
            }}
          >
            {statuses.map((s, index) => {
              const active = draft === s;
              const chip = (
                <AnimatedPressable
                  variant="button"
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    void haptics.selection();
                    setDraft(toggleExclusiveValue(draft, s, 'ALL'));
                  }}
                  style={{
                    minWidth: 96,
                    maxWidth: 180,
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: theme.spacing.sm,
                    minHeight: 40,
                    borderRadius: theme.radius.lg,
                    backgroundColor: active ? colors.brandSoft : colors.surface,
                    borderWidth: 1,
                    borderColor: active ? colors.brand : colors.border,
                    overflow: 'hidden',
                    justifyContent: 'center',
                  }}
                >
                  {active ? (
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
                  ) : null}
                  <AppText
                    variant="label"
                    weight={active ? titleWeight : 'medium'}
                    numberOfLines={1}
                    style={{
                      color: active ? colors.brand : colors.textPrimary,
                      textAlign: isRTL ? 'right' : 'left',
                      paddingLeft: active && !isRTL ? 4 : 0,
                      paddingRight: active && isRTL ? 4 : 0,
                    }}
                  >
                    {statusLabel(s)}
                  </AppText>
                </AnimatedPressable>
              );
              if (reduce) return <View key={s}>{chip}</View>;
              return (
                <Animated.View
                  key={s}
                  entering={FadeInDown.delay(24 + index * 24).duration(180)}
                >
                  {chip}
                </Animated.View>
              );
            })}
          </View>
        </View>

        {warehouses.length > 0 ? (
          <View
            style={{
              borderRadius: theme.radius.xl,
              borderWidth: 1,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surfaceSecondary,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
              overflow: 'hidden',
            }}
          >
            {draftWarehouse ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: colors.brand,
                  opacity: 0.85,
                  ...(isRTL ? { right: 0 } : { left: 0 }),
                }}
              />
            ) : null}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <Ionicons name="cube-outline" size={16} color={colors.brand} />
              <AppText
                variant="caption"
                style={{
                  flex: 1,
                  textTransform: locale === 'ar' ? 'none' : 'uppercase',
                  letterSpacing: locale === 'ar' ? 0 : 0.6,
                  fontSize: 11,
                  color: colors.brand,
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                {t('mobile.purchasing.warehouse')}
              </AppText>
            </View>
            <PurchasingWarehousePickList
              warehouses={[{ id: '', name: t('common.all') }, ...warehouses]}
              selectedId={draftWarehouse}
              onSelect={setDraftWarehouse}
              listHeight={Math.round(height * 0.32)}
            />
          </View>
        ) : null}

        {!hideDates ? (
        <View
          style={{
            borderRadius: theme.radius.xl,
            borderWidth: 1,
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceSecondary,
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              gap: theme.spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <DatePickerField
                label={t('mobile.purchasing.dateFrom')}
                value={draftFrom}
                onChange={setDraftFrom}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DatePickerField
                label={t('mobile.purchasing.dateTo')}
                value={draftTo}
                onChange={setDraftTo}
              />
            </View>
          </View>
        </View>
        ) : null}

        <View
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
            paddingTop: theme.spacing.sm,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          <SecondaryButton
            label={t('mobile.purchasing.filterReset')}
            onPress={() => {
              void haptics.selection();
              setDraft('ALL');
              setDraftFrom('');
              setDraftTo('');
              setDraftWarehouse('');
            }}
            style={{ flex: 1, borderRadius: theme.radius.xl }}
          />
          <PrimaryButton
            label={t('mobile.purchasing.filterApply')}
            onPress={() => {
              void haptics.confirmLight();
              onApply({
                status: draft,
                dateFrom: hideDates ? undefined : draftFrom.trim() || undefined,
                dateTo: hideDates ? undefined : draftTo.trim() || undefined,
                warehouseId: draftWarehouse || undefined,
              });
              onClose();
            }}
            style={{ flex: 1.35, borderRadius: theme.radius.xl }}
          />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
