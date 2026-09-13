import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { specCategoryMark } from '../selectSpecOptions';

type Props = {
  category: string;
  name: string;
  hex?: string | null;
  empty?: boolean;
  onPress?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
};

/**
 * Factory spec ticket — category stamp band + named line.
 * Not a chip row, not a measurement card.
 */
export function SpecFloorRow({
  category,
  name,
  hex,
  empty = false,
  onPress,
  onEdit,
  onRemove,
}: Props) {
  const { colors, theme, colorScheme } = useTheme();
  const { isRTL, locale, t } = useLocale();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mark = specCategoryMark(category, locale);

  const iconBtn = {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  };

  const body = (
    <View>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          paddingVertical: theme.spacing.sm,
          backgroundColor: colors.surfaceSecondary,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <View
          style={{
            minWidth: 28,
            height: 28,
            paddingHorizontal: 6,
            borderRadius: 8,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.brandSoft,
            borderWidth: 1,
            borderColor: colors.brand,
          }}
        >
          <AppText
            variant="caption"
            weight={titleWeight}
            style={{ color: colors.brand, fontSize: 11, lineHeight: 14 }}
          >
            {mark}
          </AppText>
        </View>
        <AppText
          variant="caption"
          weight={titleWeight}
          numberOfLines={1}
          style={{
            flex: 1,
            color: colors.brand,
            fontSize: 11,
            letterSpacing: locale === 'ar' ? 0 : 0.45,
            textTransform: locale === 'ar' ? 'none' : 'uppercase',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {category}
        </AppText>
        {hex ? (
          <View
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: hex,
              borderWidth: 1,
              borderColor: colors.borderStrong,
            }}
          />
        ) : null}
      </View>
      <View
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          ...(isRTL
            ? { paddingRight: theme.spacing.md + 4 }
            : { paddingLeft: theme.spacing.md + 4 }),
          paddingVertical: theme.spacing.md,
        }}
      >
        <AppText
          variant="label"
          weight={empty ? 'medium' : titleWeight}
          numberOfLines={2}
          style={{
            flex: 1,
            minWidth: 0,
            color: empty ? colors.textMuted : colors.textPrimary,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {name}
        </AppText>
        {onEdit ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('common.edit')}
            onPress={() => {
              void haptics.selection();
              onEdit();
            }}
            style={iconBtn}
          >
            <Ionicons name="pencil-outline" size={16} color={colors.brand} />
          </AnimatedPressable>
        ) : null}
        {onRemove ? (
          <AnimatedPressable
            variant="button"
            accessibilityRole="button"
            accessibilityLabel={t('common.delete')}
            onPress={() => {
              void haptics.selection();
              onRemove();
            }}
            style={{ ...iconBtn, backgroundColor: colors.errorSoft, borderColor: colors.border }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </AnimatedPressable>
        ) : null}
        {onPress && !onEdit && !onRemove ? (
          <Ionicons
            name={isRTL ? 'chevron-back' : 'chevron-forward'}
            size={16}
            color={colors.textMuted}
          />
        ) : null}
      </View>
    </View>
  );

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
      {onPress && !onEdit ? (
        <AnimatedPressable
          variant="card"
          accessibilityRole="button"
          accessibilityLabel={`${category} · ${name}`}
          onPress={() => {
            void haptics.selection();
            onPress();
          }}
        >
          {body}
        </AnimatedPressable>
      ) : (
        body
      )}
    </View>
  );
}
