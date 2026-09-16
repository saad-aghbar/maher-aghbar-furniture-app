import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import { workerItemWorkState, type WorkerOrderCardModel } from '../selectWorkerOrder';

type Props = {
  item: WorkerOrderCardModel;
  onPress: () => void;
};

const THUMB = 56;
const BADGE = 22;

/**
 * Nested production-order line inside a worker sales-order board — not a nested board.
 */
export function WorkerSalesOrderItemRow({ item, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mediaUri = resolveOrderMediaUri(item.imageUrl);
  const workState = workerItemWorkState(item);

  const hint = !item.assignedToMe
    ? t('mobile.tasks.viewOnly')
    : workState === 'done'
      ? t('mobile.tasks.segments.done')
      : workState === 'locked'
        ? t('mobile.tasks.lockLocked')
        : t('mobile.tasks.orderCardTasks', { count: item.myTaskCount });

  const statusLabel =
    workState === 'done'
      ? t('mobile.tasks.itemStatusDone')
      : workState === 'locked'
        ? t('mobile.tasks.itemStatusLocked')
        : null;

  const variant = item.variantLabel?.trim() || null;
  const title =
    variant && item.productTitle.endsWith(` · ${variant}`)
      ? item.productTitle.slice(0, -(variant.length + 3)).trim() || item.productTitle
      : item.productTitle;

  const factParts = [
    item.quantity ? t('mobile.tasks.qtyLabel', { n: item.quantity }) : null,
    hint,
  ].filter(Boolean);

  const borderColor =
    workState === 'done'
      ? colors.success
      : workState === 'locked'
        ? colors.error
        : colors.border;

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={`${item.productTitle} ${factParts.join(' · ')}${
        statusLabel ? ` ${statusLabel}` : ''
      }`}
      onPress={() => {
        void haptics.selection();
        onPress();
      }}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        minHeight: THUMB + theme.spacing.sm,
        backgroundColor: colors.surfaceSecondary,
        borderWidth: 1,
        borderColor,
      }}
    >
      <View style={{ width: THUMB, height: THUMB }}>
        <ProductThumb uri={mediaUri} size={THUMB} radius={theme.radius.md} />
        {workState === 'done' || workState === 'locked' ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              bottom: -2,
              ...(isRTL ? { left: -2 } : { right: -2 }),
              width: BADGE,
              height: BADGE,
              borderRadius: BADGE / 2,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor:
                workState === 'done' ? colors.successSoft : colors.errorSoft,
              borderWidth: 1.5,
              borderColor: workState === 'done' ? colors.success : colors.error,
            }}
          >
            <Ionicons
              name={workState === 'done' ? 'checkmark' : 'close'}
              size={13}
              color={workState === 'done' ? colors.success : colors.error}
            />
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText
          variant="label"
          weight={titleWeight}
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {title}
        </AppText>
        {variant ? (
          <View
            style={{
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              flexWrap: 'wrap',
            }}
          >
            <View
              style={{
                paddingHorizontal: theme.spacing.sm,
                paddingVertical: 2,
                borderRadius: theme.radius.md,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.brand,
              }}
            >
              <AppText
                variant="caption"
                weight={titleWeight}
                numberOfLines={1}
                style={{ color: colors.brand, fontSize: 10, lineHeight: 12 }}
              >
                {variant}
              </AppText>
            </View>
          </View>
        ) : null}
        <AppText
          variant="caption"
          numberOfLines={1}
          style={{
            color:
              workState === 'done'
                ? colors.success
                : workState === 'locked'
                  ? colors.error
                  : item.assignedToMe
                    ? colors.textSecondary
                    : colors.textMuted,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {factParts.join(' · ')}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}

export const WORKER_SALES_ORDER_ITEM_THUMB = THUMB;
