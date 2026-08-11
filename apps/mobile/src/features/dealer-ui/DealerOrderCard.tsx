import { Image, View } from 'react-native';
import { AppText } from '@/components/AppText';
import { AnimatedPressable, ProgressBar, haptics } from '@/motion';
import { useLocale } from '@/i18n';
import { useTheme } from '@/theme';
import { DealerStatusBadge } from './DealerStatusBadge';

type Props = {
  title: string;
  subtitle?: string;
  statusLabel?: string;
  statusTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  progressLabel?: string;
  progressPercent?: number;
  deliveryLabel?: string;
  priceLabel?: string;
  imageUri?: string | null;
  onPress: () => void;
  onProgressPress?: () => void;
};

export function DealerOrderCard({
  title,
  subtitle,
  statusLabel,
  statusTone = 'neutral',
  progressLabel,
  progressPercent,
  deliveryLabel,
  priceLabel,
  imageUri,
  onPress,
  onProgressPress,
}: Props) {
  const { isRTL, locale } = useLocale();
  const { colors, theme } = useTheme();
  const titleWeight = locale === 'ar' ? 'medium' : 'semibold';
  const pct =
    progressPercent == null
      ? null
      : Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <AnimatedPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        flexDirection: isRTL ? 'row-reverse' : 'row',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        borderStartWidth: 4,
        borderStartColor: colors.brand,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
          backgroundColor: colors.surfaceSecondary,
        }}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        ) : null}
      </View>
      <View style={{ flex: 1, gap: 4, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
        <AppText
          variant="body"
          weight={titleWeight}
          numberOfLines={1}
          style={{ color: colors.textPrimary, textAlign: isRTL ? 'right' : 'left', alignSelf: 'stretch' }}
        >
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="muted" numberOfLines={1} style={{ textAlign: isRTL ? 'right' : 'left' }}>
            {subtitle}
          </AppText>
        ) : null}
        {statusLabel ? <DealerStatusBadge label={statusLabel} tone={statusTone} /> : null}
        <View
          style={{
            flexDirection: isRTL ? 'row-reverse' : 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: 2,
          }}
        >
          {progressLabel ? (
            <AppText variant="caption" color="secondary">
              {progressLabel}
            </AppText>
          ) : null}
          {deliveryLabel ? (
            <AppText variant="caption" color="secondary">
              {deliveryLabel}
            </AppText>
          ) : null}
          {priceLabel ? (
            <AppText variant="caption" weight="medium" style={{ color: colors.textPrimary }}>
              {priceLabel}
            </AppText>
          ) : null}
        </View>
        {pct != null ? (
          <AnimatedPressable
            onPress={() => {
              void haptics.selection();
              onProgressPress?.();
            }}
            disabled={!onProgressPress}
            accessibilityRole={onProgressPress ? 'button' : undefined}
            style={{ alignSelf: 'stretch', marginTop: theme.spacing.xs, gap: 4 }}
          >
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                justifyContent: 'space-between',
              }}
            >
              <AppText variant="caption" color="secondary" style={{ flex: 1 }}>
                {progressLabel ?? `${pct}%`}
              </AppText>
              <AppText variant="caption" weight="semibold" style={{ color: colors.brand }} dir="ltr">
                {`${pct}%`}
              </AppText>
            </View>
            <ProgressBar
              progress={pct / 100}
              height={5}
              fillStyle={{ backgroundColor: colors.brand }}
              trackStyle={{ backgroundColor: colors.surfaceSecondary }}
            />
          </AnimatedPressable>
        ) : null}
      </View>
    </AnimatedPressable>
  );
}
