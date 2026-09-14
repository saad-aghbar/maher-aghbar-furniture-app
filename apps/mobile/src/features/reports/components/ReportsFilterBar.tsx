import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { costFilterActiveCount, type CostFilterState } from '../costFilters';

type Chip = { key: keyof CostFilterState; label: string };

type Props = {
  filter: CostFilterState;
  chips: Chip[];
  onOpen: () => void;
  onClear: () => void;
  onRemove: (key: keyof CostFilterState) => void;
};

export function ReportsFilterBar({ filter, chips, onOpen, onClear, onRemove }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const count = costFilterActiveCount(filter);
  const active = count > 0;
  const a11y =
    active ? t('mobile.reports.filtersCount', { n: String(count) }) : t('mobile.reports.filterTitle');

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.sm,
          alignItems: 'stretch',
        }}
      >
        <AnimatedPressable
          variant="button"
          testID="cost-filters-open"
          accessibilityRole="button"
          accessibilityLabel={a11y}
          accessibilityState={{ selected: active }}
          onPress={() => {
            void haptics.selection();
            onOpen();
          }}
          style={{
            flex: 1,
            minHeight: 48,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radius.xl,
            backgroundColor: active ? colors.brandSoft : colors.surface,
            borderWidth: 1.5,
            borderColor: active ? colors.brand : colors.borderStrong,
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
            overflow: 'hidden',
            ...(active
              ? isRTL
                ? { paddingRight: theme.spacing.md + 4 }
                : { paddingLeft: theme.spacing.md + 4 }
              : null),
            ...orderBoardShadow(colorScheme),
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
                opacity: 0.55,
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
              backgroundColor: active ? colors.surface : colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: active ? colors.brand : colors.border,
            }}
          >
            <Ionicons
              name="options-outline"
              size={15}
              color={active ? colors.brand : colors.textSecondary}
            />
          </View>
          <AppText
            variant="label"
            weight={titleWeight}
            numberOfLines={1}
            style={{
              flex: 1,
              minWidth: 0,
              color: active ? colors.brand : colors.textPrimary,
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            {t('mobile.reports.filterTitle')}
          </AppText>
          {active ? (
            <View
              style={{
                minWidth: 22,
                height: 22,
                paddingHorizontal: 6,
                borderRadius: 11,
                backgroundColor: colors.brand,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText
                variant="caption"
                weight="semibold"
                dir="ltr"
                style={{ color: colors.onBrand, fontSize: 11, lineHeight: 14 }}
              >
                {String(count)}
              </AppText>
            </View>
          ) : null}
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={16}
            color={active ? colors.brand : colors.textMuted}
          />
        </AnimatedPressable>
        {active ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('mobile.reports.clearAll')}
            onPress={() => {
              void haptics.selection();
              onClear();
            }}
            style={{
              minHeight: 48,
              paddingHorizontal: theme.spacing.md,
              borderRadius: theme.radius.xl,
              borderWidth: 1.5,
              borderColor: colors.borderStrong,
              backgroundColor: colors.surface,
              justifyContent: 'center',
              ...orderBoardShadow(colorScheme),
            }}
          >
            <AppText variant="label" weight={titleWeight}>
              {t('mobile.reports.clearAll')}
            </AppText>
          </AnimatedPressable>
        ) : null}
      </View>
      {chips.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            gap: theme.spacing.sm,
          }}
        >
          {chips.map((chip) => (
            <AnimatedPressable
              key={String(chip.key)}
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={chip.label}
              onPress={() => {
                void haptics.selection();
                onRemove(chip.key);
              }}
              style={{
                minHeight: 36,
                borderRadius: theme.radius.lg,
                borderWidth: 1.5,
                borderColor: colors.brand,
                backgroundColor: colors.brandSoft,
                paddingHorizontal: theme.spacing.md,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                gap: theme.spacing.xs,
                overflow: 'hidden',
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
              <AppText
                variant="caption"
                weight={titleWeight}
                numberOfLines={1}
                style={{ color: colors.brand }}
              >
                {chip.label}
              </AppText>
              <Ionicons name="close" size={14} color={colors.brand} />
            </AnimatedPressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
