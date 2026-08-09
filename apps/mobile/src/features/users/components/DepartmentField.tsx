import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DepartmentRow } from '@/api/modules/users';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { localizedName } from '@maher/i18n';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  department: DepartmentRow | null | undefined;
  onPress: () => void;
  onClear?: () => void;
};

/**
 * Department picker trigger — unified floor board with in-pill clear.
 */
export function DepartmentField({ department, onPress, onClear }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const selected = Boolean(department);
  const title = department
    ? localizedName(locale, department, department.code)
    : t('users.pickDepartment');

  return (
    <View
      style={{
        borderRadius: theme.radius.xl,
        borderWidth: 1.5,
        borderColor: selected ? colors.brand : colors.borderStrong,
        backgroundColor: selected ? colors.brandSoft : colors.surfaceSecondary,
        overflow: 'hidden',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'stretch',
        ...orderBoardShadow(colorScheme),
      }}
    >
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={title}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: theme.sizes.touch.min + 4,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm + 2,
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: selected ? colors.brand : colors.border,
          }}
        >
          <Ionicons
            name="business-outline"
            size={18}
            color={selected ? colors.brand : colors.textSecondary}
          />
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText
            variant="body"
            weight={selected ? titleWeight : 'regular'}
            color={selected ? 'brand' : 'muted'}
            numberOfLines={1}
            style={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {title}
          </AppText>
        </View>

        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color={selected ? colors.brand : colors.textMuted}
        />
      </AnimatedPressable>

      {selected && onClear ? (
        <View
          style={{
            width: 1,
            alignSelf: 'stretch',
            marginVertical: theme.spacing.sm + 2,
            backgroundColor: selected ? `${colors.brand}35` : colors.border,
          }}
        />
      ) : null}

      {selected && onClear ? (
        <AnimatedPressable
          variant="button"
          accessibilityRole="button"
          accessibilityLabel={t('users.noDepartment')}
          onPress={() => {
            void haptics.selection();
            onClear();
          }}
          style={{
            width: theme.sizes.touch.min + 4,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandSoft,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Ionicons name="close" size={15} color={colors.brand} />
          </View>
        </AnimatedPressable>
      ) : null}
    </View>
  );
}
