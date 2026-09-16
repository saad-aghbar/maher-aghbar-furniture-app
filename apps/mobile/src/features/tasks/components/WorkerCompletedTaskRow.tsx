import { View } from 'react-native';
import { AppText } from '@/components/AppText';
import { ProductThumb } from '@/components/desk/ProductThumb';
import { resolveOrderMediaUri } from '@/features/sales-orders/components/OrderCardMedia';
import { useLocale } from '@/i18n';
import { AnimatedPressable, haptics } from '@/motion';
import { useTheme } from '@/theme';
import type { TaskCardModel } from '../selectTask';

type Props = {
  task: TaskCardModel;
  onPress: () => void;
};

const THUMB = 56;

/**
 * Nested finished task inside a completed sales-order board — not a nested board.
 */
export function WorkerCompletedTaskRow({ task, onPress }: Props) {
  const { t, isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const mediaUri = resolveOrderMediaUri(task.imageUrl);

  const variant = task.variantLabel?.trim() || null;
  const title =
    variant && task.productTitle.endsWith(` · ${variant}`)
      ? task.productTitle.slice(0, -(variant.length + 3)).trim() || task.productTitle
      : task.productTitle || task.title;

  const stage = task.requiredWork || task.title;
  const fact = t('mobile.tasks.segments.done');

  return (
    <AnimatedPressable
      variant="button"
      accessibilityRole="button"
      accessibilityLabel={`${title} ${stage} ${fact}`}
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
        borderColor: colors.border,
      }}
    >
      <ProductThumb uri={mediaUri} size={THUMB} radius={theme.radius.md} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <AppText
          variant="label"
          weight={titleWeight}
          numberOfLines={1}
          style={{ textAlign: isRTL ? 'right' : 'left' }}
        >
          {title}
        </AppText>
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
              borderColor: colors.success,
            }}
          >
            <AppText
              variant="caption"
              weight={titleWeight}
              numberOfLines={1}
              style={{ color: colors.success, fontSize: 10, lineHeight: 12 }}
            >
              {stage}
            </AppText>
          </View>
          {variant ? (
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
          ) : null}
        </View>
        <AppText
          variant="caption"
          numberOfLines={1}
          style={{
            color: colors.success,
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {fact}
        </AppText>
      </View>
    </AnimatedPressable>
  );
}
