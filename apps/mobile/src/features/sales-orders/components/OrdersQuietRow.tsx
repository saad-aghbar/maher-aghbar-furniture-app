import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { StatusBadge } from '@/components/badges/StatusBadge';
import { useLocale } from '@/i18n';
import { AnimatedPressable, ListItemEnter, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { OrderCardMedia } from './OrderCardMedia';
import { orderBoardShadow } from './orderFloorStyle';

export type QuietOrderRowModel = {
  id: string;
  number: string;
  status: string;
  title: string;
  imageUrl: string | null;
  deliveryDate: string | null;
  kind?: 'order' | 'rfq';
};

type Props = {
  order: QuietOrderRowModel;
  index: number;
  onPress: () => void;
};

/** Browse row for workbench / ledger — elevated floor card. */
export function OrdersQuietRow({ order, index, onPress }: Props) {
  const { formatDate, isRTL, locale } = useLocale();
  const { colors, theme, colorScheme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';

  return (
    <ListItemEnter index={index}>
      <AnimatedPressable
        variant="card"
        accessibilityRole="button"
        accessibilityLabel={`${order.number} ${order.title}`}
        onPress={() => {
          void haptics.selection();
          onPress();
        }}
        style={{
          flexDirection: isRTL ? 'row-reverse' : 'row',
          gap: theme.spacing.md,
          alignItems: 'center',
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
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
            position: 'absolute',
            top: 0,
            bottom: 0,
            ...(isRTL ? { right: 0 } : { left: 0 }),
            width: 3,
            backgroundColor: colors.brand,
            opacity: 0.45,
          }}
        />
        <OrderCardMedia imageUrl={order.imageUrl} size={52} />
        <View style={{ flex: 1, gap: 4, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <AppText variant="label" weight={titleWeight} numberOfLines={1}>
            {order.title}
          </AppText>
          <AppText
            variant="caption"
            color="secondary"
            numberOfLines={1}
            dir="ltr"
            style={{ letterSpacing: 0.2 }}
          >
            {order.number}
          </AppText>
          {order.deliveryDate ? (
            <AppText variant="caption" color="muted">
              {formatDate(order.deliveryDate)}
            </AppText>
          ) : null}
        </View>
        <StatusBadge status={order.status} dot />
      </AnimatedPressable>
    </ListItemEnter>
  );
}
