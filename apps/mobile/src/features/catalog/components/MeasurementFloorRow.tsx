import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics, ListItemEnter } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  index: number;
  name: string;
  secondary?: string | null;
  valueLabel: string;
  onRemove: () => void;
  onEdit?: () => void;
};

export function displayMeasurementUnit(unit?: string | null): string {
  const u = String(unit ?? 'cm').trim();
  return u || 'cm';
}

/** Custom measurement card — name, value chip, optional edit, delete. */
export function MeasurementFloorRow({
  index,
  name,
  secondary,
  valueLabel,
  onRemove,
  onEdit,
}: Props) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale, t } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  const iconBtn = {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: colors.border,
  };

  return (
    <ListItemEnter index={index}>
      <View
        style={{
          borderRadius: theme.radius.xl,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: colors.surfaceSecondary,
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
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.75,
          }}
        />
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
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
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="resize-outline" size={18} color={colors.brand} />
          </View>

          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <AppText
              variant="label"
              weight={titleWeight}
              numberOfLines={1}
              style={{ textAlign: isRTL ? 'right' : 'left' }}
            >
              {name}
            </AppText>
            {secondary ? (
              <AppText
                variant="caption"
                color="muted"
                numberOfLines={1}
                style={{ textAlign: isRTL ? 'right' : 'left' }}
              >
                {secondary}
              </AppText>
            ) : null}
          </View>

          <View
            style={{
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.borderStrong,
            }}
          >
            <AppText
              variant="label"
              weight={titleWeight}
              dir="ltr"
              style={{ color: colors.brand }}
            >
              {valueLabel}
            </AppText>
          </View>

          {onEdit ? (
            <AnimatedPressable
              variant="button"
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}
              onPress={() => {
                void haptics.selection();
                onEdit();
              }}
              style={{ ...iconBtn, backgroundColor: colors.surface }}
            >
              <Ionicons name="pencil-outline" size={16} color={colors.brand} />
            </AnimatedPressable>
          ) : null}

          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            onPress={() => {
              void haptics.selection();
              onRemove();
            }}
            style={{ ...iconBtn, backgroundColor: colors.errorSoft }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </AnimatedPressable>
        </View>
      </View>
    </ListItemEnter>
  );
}
