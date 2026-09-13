import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { orderBoardShadow } from '@/features/sales-orders/components/orderFloorStyle';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';

type Props = {
  onReceive?: () => void;
  onCreatePo?: () => void;
};

/**
 * Item-detail sticky dock — one parchment tray, matching wood pills.
 * Same family as invoice sticky actions; inner CTAs match sheet primaries.
 */
export function InventoryReceiveDock({ onReceive, onCreatePo }: Props) {
  const { t, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  if (!onReceive && !onCreatePo) return null;

  return (
    <View
      style={{
        gap: theme.spacing.sm,
        borderRadius: theme.radius.xl,
        borderWidth: 1,
        borderColor: colors.borderStrong,
        backgroundColor:
          colorScheme === 'dark' ? 'rgba(42,36,37,0.96)' : colors.surface,
        padding: theme.spacing.sm,
        overflow: 'hidden',
        ...orderBoardShadow(colorScheme),
      }}
    >
      {onCreatePo ? (
        <DockPill
          label={t('mobile.inventory.createPurchaseOrder')}
          titleWeight={titleWeight}
          onPress={onCreatePo}
          haptic="medium"
        />
      ) : null}
      {onReceive ? (
        <DockPill
          label={t('mobile.inventory.receive')}
          icon="download-outline"
          titleWeight={titleWeight}
          onPress={onReceive}
          haptic="light"
        />
      ) : null}
    </View>
  );
}

function DockPill({
  label,
  icon,
  titleWeight,
  onPress,
  haptic,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  titleWeight: 'medium' | 'semibold';
  onPress: () => void;
  haptic: 'light' | 'medium';
}) {
  const { isRTL } = useLocale();
  const { colors, theme } = useTheme();

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        if (haptic === 'light') void haptics.confirmLight();
        else void haptics.confirmMedium();
        onPress();
      }}
      style={{
        minHeight: theme.sizes.touch.min,
        borderRadius: theme.radius.full,
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        paddingHorizontal: theme.spacing.xl,
        backgroundColor: colors.brand,
      }}
    >
      {icon ? <Ionicons name={icon} size={18} color={colors.onBrand} /> : null}
      <AppText
        variant="label"
        weight={titleWeight}
        numberOfLines={1}
        align="center"
        style={{ color: colors.onBrand }}
      >
        {label}
      </AppText>
    </AnimatedPressable>
  );
}
