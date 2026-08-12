import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { BottomSheet } from '@/components/sheets/BottomSheet';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { StatementDatePreset } from '../selectStatement';

type TriggerProps = {
  value: StatementDatePreset;
  onPress: () => void;
};

const PRESET_LABEL: Record<StatementDatePreset, string> = {
  all: 'mobile.account.dateAll',
  '30d': 'mobile.account.date30d',
  '90d': 'mobile.account.date90d',
};

/** Floor trigger for statement date presets. */
export function StatementDateTrigger({ value, onPress }: TriggerProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const active = value !== 'all';

  return (
    <View
      style={{
        alignSelf: 'stretch',
        width: '100%',
        borderRadius: theme.radius.xl,
        backgroundColor: active ? colors.brandSoft : colors.surfaceSecondary,
        borderWidth: 1.5,
        borderColor: active ? colors.brand : colors.borderStrong,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        ...orderBoardShadow(colorScheme),
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

      <AnimatedPressable
        variant="button"
        accessibilityRole="button"
        accessibilityLabel={t('mobile.account.dateFilterTitle')}
        accessibilityState={{ selected: active }}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          minHeight: 48,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + (active ? 4 : 0) }
            : { paddingLeft: theme.spacing.md + (active ? 4 : 0) }),
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
            borderColor: colors.border,
          }}
        >
          <Ionicons name="calendar-outline" size={16} color={colors.brand} />
        </View>
        <AppText
          variant="body"
          weight={titleWeight}
          numberOfLines={1}
          style={{ flex: 1, color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left' }}
        >
          {t(PRESET_LABEL[value])}
        </AppText>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={colors.textMuted}
        />
      </AnimatedPressable>
    </View>
  );
}

type SheetProps = {
  open: boolean;
  onClose: () => void;
  value: StatementDatePreset;
  onChange: (next: StatementDatePreset) => void;
};

const PRESETS: StatementDatePreset[] = ['all', '30d', '90d'];

export function StatementDateSheet({ open, onClose, value, onChange }: SheetProps) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('mobile.account.dateFilterTitle')}
      fitContent
    >
      <View style={{ gap: theme.spacing.sm }}>
        {PRESETS.map((preset) => {
          const selected = preset === value;
          return (
            <AnimatedPressable
              key={preset}
              variant="button"
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                void haptics.selection();
                onChange(preset);
                onClose();
              }}
              style={{
                minHeight: 48,
                borderRadius: theme.radius.xl,
                borderWidth: 1.5,
                borderColor: selected ? colors.brand : colors.borderStrong,
                backgroundColor: selected ? colors.brandSoft : colors.surface,
                paddingHorizontal: theme.spacing.lg,
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <AppText
                weight={selected ? titleWeight : 'medium'}
                style={{ color: selected ? colors.brand : colors.textPrimary }}
              >
                {t(PRESET_LABEL[preset])}
              </AppText>
              {selected ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.brand} />
              ) : null}
            </AnimatedPressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}
